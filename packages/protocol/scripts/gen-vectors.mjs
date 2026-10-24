#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Regenerates the shared token vectors in `fixtures/unlock-tokens/` and
 * `fixtures/policy-tokens/` from the TEST-ONLY keys in `fixtures/keys/`.
 *
 * Ed25519 is deterministic, so the output is byte-for-byte stable; a test
 * (`test/vectors_are_regenerable.test.ts`) fails if the committed files drift
 * from what this script produces.
 *
 *   node scripts/gen-vectors.mjs          # write the vectors
 *   node scripts/gen-vectors.mjs --check  # exit 1 if the committed files differ
 *
 * Runs the TypeScript sources directly (Node >= 24 strips types natively).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalPolicyClaims,
  canonicalUnlockClaims,
  decodeBase64Url,
  encodeBase64Url,
  encodeKidFooter,
  implicitAssertionText,
  issuePolicyToken,
  issueUnlockToken,
  pae,
  parseRfc3339Utc,
  formatRfc3339Utc,
  privateKeyFromSeed,
  signV4Public,
  V4_PUBLIC_HEADER,
} from '../src/index.ts'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEYS_FILE = 'fixtures/keys/TEST-ONLY-test-key-not-real.ed25519.json'
const VECTOR_DIRS = ['fixtures/unlock-tokens', 'fixtures/policy-tokens']
const utf8 = new TextEncoder()

const ISSUER = 'https://focus.example.org'
const OTHER_ISSUER = 'https://other.example.net'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const OTHER_DEVICE = '0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a'
const SUBJECT = 'user-1'
const sha256Base64Url = (text) => createHash('sha256').update(text).digest('base64url')
const POLICY_HASH = sha256Base64Url('monki-focus synthetic policy v1')
const RULES_HASH = sha256Base64Url('monki-focus synthetic rule set v1')

const at = (text) => {
  const seconds = parseRfc3339Utc(text)
  if (seconds === null) throw new Error(`bad time ${text}`)
  return seconds
}
const shift = (text, seconds) => formatRfc3339Utc(at(text) + seconds)

function loadKeys() {
  const document = JSON.parse(readFileSync(join(packageRoot, KEYS_FILE), 'utf8'))
  const keys = {}
  for (const entry of document.keys) {
    const secretKey = privateKeyFromSeed(Uint8Array.from(Buffer.from(entry.seedHex, 'hex')))
    if (!secretKey.ok) throw new Error(`bad seed for ${entry.name}`)
    keys[entry.name] = { ...entry, secretKey: secretKey.value }
  }
  return keys
}

const keys = loadKeys()
const unlockA = keys['test-key-not-real-unlock-a']
const unlockB = keys['test-key-not-real-unlock-b']
const policyA = keys['test-key-not-real-policy-a']
const untrusted = keys['test-key-not-real-untrusted']

const pinned = (...entries) => entries.map(({ kid, publicKeyHex }) => ({ kid, publicKeyHex }))

const baseUnlockClaims = Object.freeze({
  v: 1,
  typ: 'unlock',
  iss: ISSUER,
  sub: SUBJECT,
  dev: DEVICE,
  rule: 'social.video-feed',
  scope: { kind: 'domain', value: 'video.example.com' },
  dur_s: 900,
  iat: '2026-01-05T09:00:00Z',
  nbf: '2026-01-05T09:00:00Z',
  exp: '2026-01-05T09:30:00Z',
  jti: '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b',
  req: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  pol: POLICY_HASH,
})

const basePolicyClaims = Object.freeze({
  v: 1,
  typ: 'policy',
  iss: ISSUER,
  sub: SUBJECT,
  dev: DEVICE,
  ver: 7,
  tz: 'Etc/UTC',
  rules_sha256: RULES_HASH,
  iat: '2026-01-05T08:00:00Z',
  nbf: '2026-01-05T08:00:00Z',
  exp: '2026-01-12T08:00:00Z',
  jti: '9c8b7a6f-5e4d-4c3b-8a29-18f7e6d5c4b3',
})

const NOW = '2026-01-05T09:05:00Z'

/**
 * Signs `payload` exactly as given (a claims object is serialised in
 * canonical order; a string is signed verbatim, for malformed-claims cases).
 */
function sign({ payload, key, footer, assertion }) {
  const claimsJson =
    typeof payload === 'string'
      ? payload
      : payload.typ === 'policy'
        ? canonicalPolicyClaims(payload)
        : canonicalUnlockClaims(payload)
  const footerText = footer ?? new TextDecoder().decode(encodeKidFooter(key.kid))
  const message = utf8.encode(claimsJson)
  const footerBytes = utf8.encode(footerText)
  const assertionBytes = utf8.encode(assertion)
  const token = signV4Public(key.secretKey, message, footerBytes, assertionBytes)
  return {
    token,
    construction: {
      signingKey: key.name,
      claimsJson,
      footer: footerText,
      implicitAssertion: assertion,
      paeHex: Buffer.from(
        pae([utf8.encode(V4_PUBLIC_HEADER), message, footerBytes, assertionBytes])
      ).toString('hex'),
    },
  }
}

function signUnlock(
  claims,
  { key = unlockA, footer, issuer = claims.iss ?? ISSUER, device = claims.dev ?? DEVICE } = {}
) {
  return sign({
    payload: claims,
    key,
    footer,
    assertion: implicitAssertionText('unlock', issuer, device),
  })
}

function signPolicy(claims, { key = policyA, issuer = claims.iss, device = claims.dev } = {}) {
  return sign({
    payload: claims,
    key,
    assertion: implicitAssertionText('policy', issuer, device),
  })
}

/** Re-encodes the body of a token after `mutate(bytes)`; keeps the footer as is. */
function mutateBody(token, mutate) {
  const [body, footer] = token.slice(V4_PUBLIC_HEADER.length).split('.')
  const bytes = decodeBase64Url(body)
  mutate(bytes)
  return `${V4_PUBLIC_HEADER}${encodeBase64Url(bytes)}${footer === undefined ? '' : `.${footer}`}`
}

/** Rewrites the encoded body text of a token; keeps header and footer. */
function withBody(token, rewrite) {
  const [body, footer] = token.slice(V4_PUBLIC_HEADER.length).split('.')
  return `${V4_PUBLIC_HEADER}${rewrite(body)}${footer === undefined ? '' : `.${footer}`}`
}

function replaceFooter(token, footerText) {
  const [body] = token.slice(V4_PUBLIC_HEADER.length).split('.')
  return `${V4_PUBLIC_HEADER}${body}.${encodeBase64Url(utf8.encode(footerText))}`
}

function vector({
  id,
  description,
  purpose = 'unlock',
  signed,
  token = signed.token,
  tampering,
  keyring = purpose === 'unlock' ? pinned(unlockA, unlockB) : pinned(policyA),
  issuer = ISSUER,
  device = DEVICE,
  now = NOW,
  expect,
}) {
  return {
    $comment:
      'Generated by scripts/gen-vectors.mjs from TEST-ONLY keys (test-key-not-real). Do not edit by hand.',
    id,
    kind: `${purpose}-token`,
    description,
    token,
    verify: { purpose, keyring, issuer, device, now },
    expect,
    construction:
      tampering === undefined ? signed.construction : { ...signed.construction, tampering },
  }
}

const valid = (claims, kid = unlockA.kid) => ({ result: 'valid', kid, claims })
const invalid = (error) => ({ result: 'invalid', error })

function issuedUnlock(claims, key = unlockA) {
  const issued = issueUnlockToken(claims, { kid: key.kid, secretKey: key.secretKey })
  const signed = signUnlock(claims, { key })
  if (!issued.ok || issued.value !== signed.token) {
    throw new Error('issueUnlockToken and the raw signer disagree')
  }
  return signed
}

function unlockVectors() {
  const base = issuedUnlock(baseUnlockClaims)
  const pathClaims = {
    ...baseUnlockClaims,
    scope: { kind: 'path', value: 'forum.example.com/r/example-topic' },
  }
  const appClaims = { ...baseUnlockClaims, scope: { kind: 'app', value: 'com.example.video' } }
  const fourHours = { ...baseUnlockClaims, exp: shift(baseUnlockClaims.iat, 4 * 3600) }
  const overFourHours = { ...baseUnlockClaims, exp: shift(baseUnlockClaims.iat, 4 * 3600 + 1) }
  const policyTypClaims = {
    ...basePolicyClaims,
    iat: baseUnlockClaims.iat,
    nbf: baseUnlockClaims.nbf,
    exp: baseUnlockClaims.exp,
  }

  return [
    vector({
      id: 'valid_unlock_token',
      description: 'A well-formed unlock token signed with the current pinned key verifies.',
      signed: base,
      expect: valid(baseUnlockClaims),
    }),
    vector({
      id: 'valid_unlock_token_signed_with_second_pinned_key',
      description: 'During a rotation both pinned kids are accepted.',
      signed: issuedUnlock(baseUnlockClaims, unlockB),
      expect: valid(baseUnlockClaims, unlockB.kid),
    }),
    vector({
      id: 'valid_unlock_token_with_path_scope',
      description: 'A scope of kind path (exact host plus literal segments) verifies.',
      signed: issuedUnlock(pathClaims),
      expect: valid(pathClaims),
    }),
    vector({
      id: 'valid_unlock_token_with_app_scope',
      description: 'A scope of kind app (package or bundle id) verifies.',
      signed: issuedUnlock(appClaims),
      expect: valid(appClaims),
    }),
    vector({
      id: 'unlock_token_valid_at_skew_before_nbf',
      description: 'Trusted now = nbf - 60 s is inside the clock-skew tolerance.',
      signed: base,
      now: shift(baseUnlockClaims.nbf, -60),
      expect: valid(baseUnlockClaims),
    }),
    vector({
      id: 'unlock_token_valid_at_skew_after_exp',
      description: 'Trusted now = exp + 60 s is inside the clock-skew tolerance.',
      signed: base,
      now: shift(baseUnlockClaims.exp, 60),
      expect: valid(baseUnlockClaims),
    }),
    vector({
      id: 'unlock_token_with_lifetime_of_exactly_four_hours_is_valid',
      description: 'exp - iat = 4 h is the maximum allowed lifetime.',
      signed: issuedUnlock(fourHours),
      expect: valid(fourHours),
    }),
    vector({
      id: 'expired_unlock_token_is_rejected_offline',
      description: 'Trusted now = exp + 61 s is past the skew tolerance.',
      signed: base,
      now: shift(baseUnlockClaims.exp, 61),
      expect: invalid('expired'),
    }),
    vector({
      id: 'not_yet_valid_unlock_token_is_rejected',
      description: 'Trusted now = nbf - 61 s is before the skew tolerance.',
      signed: base,
      now: shift(baseUnlockClaims.nbf, -61),
      expect: invalid('not_yet_valid'),
    }),
    vector({
      id: 'tampered_payload_is_rejected',
      description: 'One byte of the signed claims changed ("dur_s":900 -> "dur_s":990).',
      signed: base,
      token: mutateBody(base.token, (bytes) => {
        const index = Buffer.from(bytes).indexOf('"dur_s":900')
        bytes[index + '"dur_s":9'.length] = '9'.charCodeAt(0)
      }),
      tampering: 'claims byte changed after signing: "dur_s":900 -> "dur_s":990',
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'tampered_signature_is_rejected',
      description: 'The last signature byte is flipped.',
      signed: base,
      token: mutateBody(base.token, (bytes) => {
        bytes[bytes.length - 1] ^= 0x01
      }),
      tampering: 'last signature byte XOR 0x01',
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'tampered_footer_is_rejected',
      description:
        'The footer is swapped for the other pinned kid; the footer is signed, so this fails.',
      signed: base,
      token: replaceFooter(base.token, `{"kid":"${unlockB.kid}"}`),
      tampering: `footer replaced with {"kid":"${unlockB.kid}"}`,
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'token_for_other_device_fails_implicit_assertion',
      description: 'A token issued for another device does not verify on this one.',
      signed: base,
      device: OTHER_DEVICE,
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'token_from_other_issuer_fails_implicit_assertion',
      description: 'A token issued by another instance does not verify against the pinned issuer.',
      signed: base,
      issuer: OTHER_ISSUER,
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'unknown_kid_is_rejected',
      description: 'A token signed by a key nobody pinned, naming its own kid.',
      signed: signUnlock(baseUnlockClaims, { key: untrusted }),
      expect: invalid('unknown_kid'),
    }),
    vector({
      id: 'untrusted_key_claiming_pinned_kid_is_rejected',
      description: 'A token signed by an unpinned key whose footer claims the pinned kid.',
      signed: signUnlock(baseUnlockClaims, { key: untrusted, footer: `{"kid":"${unlockA.kid}"}` }),
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'policy_claims_presented_as_unlock_fail_typ',
      description:
        'Policy claims signed with the unlock key and unlock assertion: the signature verifies, typ does not.',
      signed: signUnlock(policyTypClaims),
      expect: invalid('wrong_typ'),
    }),
    vector({
      id: 'policy_token_presented_as_unlock_is_rejected',
      description:
        'A real policy token (policy key, policy assertion) offered to the unlock verifier.',
      signed: signPolicy(basePolicyClaims),
      expect: invalid('unknown_kid'),
    }),
    vector({
      id: 'unlock_token_lifetime_over_four_hours_is_rejected',
      description: 'exp - iat = 4 h + 1 s.',
      signed: signUnlock(overFourHours),
      expect: invalid('lifetime_too_long'),
    }),
    vector({
      id: 'unlock_duration_longer_than_token_lifetime_is_rejected',
      description: 'dur_s (3600) exceeds exp - iat (1800).',
      signed: signUnlock({ ...baseUnlockClaims, dur_s: 3600 }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'nbf_before_iat_is_rejected',
      description: 'nbf must not precede iat.',
      signed: signUnlock({ ...baseUnlockClaims, nbf: shift(baseUnlockClaims.iat, -1) }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'non_calendar_date_is_rejected',
      description: 'iat 2026-02-30 matches the shape but is not a real date.',
      signed: signUnlock({ ...baseUnlockClaims, iat: '2026-02-30T09:00:00Z' }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'fractional_seconds_are_rejected',
      description: 'Only YYYY-MM-DDTHH:MM:SSZ is accepted.',
      signed: signUnlock({ ...baseUnlockClaims, iat: '2026-01-05T09:00:00.000Z' }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'unknown_claim_is_rejected',
      description: 'additionalProperties is false: an extra claim fails the schema.',
      signed: signUnlock(
        JSON.stringify({ ...JSON.parse(canonicalUnlockClaims(baseUnlockClaims)), admin: true })
      ),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'wildcard_scope_is_rejected',
      description: 'A scope is always exact; "*.example.com" fails the schema.',
      signed: signUnlock({
        ...baseUnlockClaims,
        scope: { kind: 'domain', value: '*.example.com' },
      }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'non_json_payload_is_rejected',
      description: 'A correctly signed payload that is not JSON.',
      signed: signUnlock('this is not json'),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'claims_for_other_device_are_rejected',
      description:
        'Signed with this device in the implicit assertion but dev naming another device (defence in depth).',
      signed: signUnlock({ ...baseUnlockClaims, dev: OTHER_DEVICE }, { device: DEVICE }),
      expect: invalid('device_mismatch'),
    }),
    vector({
      id: 'claims_from_other_issuer_are_rejected',
      description:
        'Signed with the pinned issuer in the implicit assertion but iss naming another (defence in depth).',
      signed: signUnlock({ ...baseUnlockClaims, iss: OTHER_ISSUER }, { issuer: ISSUER }),
      expect: invalid('issuer_mismatch'),
    }),
    vector({
      id: 'malformed_base64url_with_padding_is_rejected',
      description: 'The body carries "=" padding.',
      signed: base,
      token: withBody(base.token, (body) => `${body}==`),
      tampering: 'appended "==" to the body',
      expect: invalid('malformed_base64url'),
    }),
    vector({
      id: 'malformed_base64url_with_standard_alphabet_is_rejected',
      description: 'The body uses "+" from the standard base64 alphabet.',
      signed: base,
      token: withBody(base.token, (body) => `+${body.slice(1)}`),
      tampering: 'first body character replaced with "+"',
      expect: invalid('malformed_base64url'),
    }),
    vector({
      id: 'malformed_base64url_non_canonical_is_rejected',
      description:
        'The last body character has non-zero unused bits: it decodes to the same bytes but is not canonical.',
      signed: base,
      token: nonCanonicalBody(base.token),
      tampering: 'last body character changed so only its unused low bits differ',
      expect: invalid('malformed_base64url'),
    }),
    vector({
      id: 'v4_local_header_is_rejected',
      description: 'Header v4.local. instead of v4.public.',
      signed: base,
      token: `v4.local.${base.token.slice(V4_PUBLIC_HEADER.length)}`,
      tampering: 'header replaced with v4.local.',
      expect: invalid('wrong_header'),
    }),
    vector({
      id: 'v3_public_header_is_rejected',
      description: 'Header v3.public. instead of v4.public.',
      signed: base,
      token: `v3.public.${base.token.slice(V4_PUBLIC_HEADER.length)}`,
      tampering: 'header replaced with v3.public.',
      expect: invalid('wrong_header'),
    }),
    vector({
      id: 'missing_footer_is_rejected',
      description: 'monki-focus tokens always carry the kid footer.',
      signed: base,
      token: base.token.slice(0, base.token.lastIndexOf('.')),
      tampering: 'footer removed',
      expect: invalid('malformed_footer'),
    }),
    vector({
      id: 'footer_with_whitespace_is_rejected',
      description: 'The footer must be exactly {"kid":"..."}; whitespace makes it malformed.',
      signed: signUnlock(baseUnlockClaims, { footer: `{"kid": "${unlockA.kid}"}` }),
      expect: invalid('malformed_footer'),
    }),
  ]
}

/** Changes the last body character to one with the same high bits but non-zero unused bits. */
function nonCanonicalBody(token) {
  const [body, footer] = token.slice(V4_PUBLIC_HEADER.length).split('.')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const unusedBits = { 2: 4, 3: 2 }[body.length % 4]
  if (unusedBits === undefined) throw new Error('body has no unused bits')
  const last = alphabet.indexOf(body.at(-1))
  const changed = alphabet[last | 1]
  if (changed === body.at(-1)) throw new Error('could not build a non-canonical body')
  return `${V4_PUBLIC_HEADER}${body.slice(0, -1)}${changed}.${footer}`
}

function policyVectors() {
  const issued = issuePolicyToken(basePolicyClaims, {
    kid: policyA.kid,
    secretKey: policyA.secretKey,
  })
  const base = signPolicy(basePolicyClaims)
  if (!issued.ok || issued.value !== base.token) {
    throw new Error('issuePolicyToken and the raw signer disagree')
  }
  const unlockTyp = { ...baseUnlockClaims }
  return [
    vector({
      purpose: 'policy',
      id: 'valid_policy_token',
      description: 'A well-formed policy token signed with the pinned policy key verifies.',
      signed: base,
      expect: valid(basePolicyClaims, policyA.kid),
    }),
    vector({
      purpose: 'policy',
      id: 'unlock_token_presented_as_policy_is_rejected',
      description: 'A real unlock token offered to the policy verifier.',
      signed: issuedUnlock(baseUnlockClaims),
      expect: invalid('unknown_kid'),
    }),
    vector({
      purpose: 'policy',
      id: 'unlock_claims_presented_as_policy_fail_typ',
      description: 'Unlock claims signed with the policy key and policy assertion fail on typ.',
      signed: sign({
        payload: unlockTyp,
        key: policyA,
        assertion: implicitAssertionText('policy', ISSUER, DEVICE),
      }),
      expect: invalid('wrong_typ'),
    }),
    vector({
      purpose: 'policy',
      id: 'policy_token_for_other_device_fails_implicit_assertion',
      description: 'A policy for another device does not verify on this one.',
      signed: base,
      device: OTHER_DEVICE,
      expect: invalid('invalid_signature'),
    }),
    vector({
      purpose: 'policy',
      id: 'policy_token_lifetime_over_thirty_days_is_rejected',
      description: 'exp - iat = 30 days + 1 s.',
      signed: signPolicy({
        ...basePolicyClaims,
        exp: shift(basePolicyClaims.iat, 30 * 24 * 3600 + 1),
      }),
      expect: invalid('lifetime_too_long'),
    }),
  ]
}

/** Every vector file as `{ path, content }`, path relative to the package root. */
export function generateVectors() {
  const files = []
  for (const [dir, vectors] of [
    ['fixtures/unlock-tokens', unlockVectors()],
    ['fixtures/policy-tokens', policyVectors()],
  ]) {
    for (const entry of vectors) {
      files.push({
        path: `${dir}/${entry.id}.json`,
        content: `${JSON.stringify(entry, null, 2)}\n`,
      })
    }
  }
  return files
}

function committedFiles() {
  const files = new Map()
  for (const dir of VECTOR_DIRS) {
    const absolute = join(packageRoot, dir)
    if (!existsSync(absolute)) continue
    for (const name of readdirSync(absolute).filter((file) => file.endsWith('.json'))) {
      files.set(`${dir}/${name}`, readFileSync(join(absolute, name), 'utf8'))
    }
  }
  return files
}

/** Paths that differ between the generator and the committed files. */
export function driftedVectors() {
  const expected = new Map(generateVectors().map(({ path, content }) => [path, content]))
  const actual = committedFiles()
  const paths = new Set([...expected.keys(), ...actual.keys()])
  return [...paths].filter((path) => expected.get(path) !== actual.get(path)).sort()
}

function main() {
  if (process.argv.includes('--check')) {
    const drift = driftedVectors()
    if (drift.length > 0) {
      console.error(`Vectors out of date (run node scripts/gen-vectors.mjs):\n${drift.join('\n')}`)
      process.exit(1)
    }
    console.log('Vectors are up to date.')
    return
  }
  for (const dir of VECTOR_DIRS) {
    rmSync(join(packageRoot, dir), { recursive: true, force: true })
    mkdirSync(join(packageRoot, dir), { recursive: true })
  }
  const files = generateVectors()
  for (const { path, content } of files) {
    writeFileSync(join(packageRoot, path), content)
  }
  console.log(`Wrote ${files.length} vectors.`)
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
