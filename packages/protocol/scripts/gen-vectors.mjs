#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Regenerates the shared token vectors in `fixtures/unlock-tokens/`,
 * `fixtures/policy-tokens/` and `fixtures/time-tokens/` from the TEST-ONLY
 * keys in `fixtures/keys/`. (The state-machine, scope-match and Ed25519 edge
 * fixtures are hand-written or vendored, not generated.)
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
  canonicalPolicyMessage,
  canonicalTimeMessage,
  canonicalUnlockMessage,
  deriveKeyId,
  decodeBase64Url,
  encodeBase64Url,
  encodeKidFooter,
  implicitAssertionText,
  issuePolicyToken,
  issueTimeToken,
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
const VECTOR_DIRS = ['fixtures/unlock-tokens', 'fixtures/policy-tokens', 'fixtures/time-tokens']
const utf8 = new TextEncoder()

const ISSUER = 'https://focus.example.org'
const OTHER_ISSUER = 'https://other.example.net'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const OTHER_DEVICE = '0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a'
const SUBJECT = 'user-1'
const NONCE = 'AAECAwQFBgcICQoLDA0ODw'
const OTHER_NONCE = 'DwAODQwLCgkIBwYFBAMCAQ'
const BOOT = '41'
const OTHER_BOOT = '42'
const L = (1n << 252n) + 27742317777372353535851937790883648493n
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
  scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
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

const baseTimeClaims = Object.freeze({
  v: 1,
  typ: 'time',
  iss: ISSUER,
  dev: DEVICE,
  nonce: NONCE,
  boot: BOOT,
  srv: '2026-01-05T09:05:00Z',
  revoked: [{ jti: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a', exp: '2026-01-05T09:40:00Z' }],
  complete: true,
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
        ? canonicalPolicyMessage(payload)
        : payload.typ === 'time'
          ? canonicalTimeMessage(payload)
          : canonicalUnlockMessage(payload)
  if (claimsJson === null) throw new Error('claims cannot be serialised canonically')
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
    assertion: implicitAssertionText('unlock', { issuer, device }),
  })
}

function signPolicy(claims, { key = policyA, issuer = claims.iss, device = claims.dev } = {}) {
  return sign({
    payload: claims,
    key,
    assertion: implicitAssertionText('policy', { issuer, device }),
  })
}

function signTime(
  claims,
  {
    key = unlockA,
    footer,
    issuer = claims.iss ?? ISSUER,
    device = claims.dev ?? DEVICE,
    nonce = claims.nonce ?? NONCE,
    boot = claims.boot ?? BOOT,
  } = {}
) {
  return sign({
    payload: claims,
    key,
    footer,
    assertion: implicitAssertionText('time', { issuer, device, nonce, boot }),
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
  keyring = purpose === 'policy' ? pinned(policyA) : pinned(unlockA, unlockB),
  issuer = ISSUER,
  device = DEVICE,
  now = NOW,
  nonce = NONCE,
  boot = BOOT,
  expect,
}) {
  const verify =
    purpose === 'time'
      ? { purpose, keyring, issuer, device, nonce, boot }
      : { purpose, keyring, issuer, device, now }
  return {
    $comment:
      'Generated by scripts/gen-vectors.mjs from TEST-ONLY keys (test-key-not-real). Do not edit by hand.',
    id,
    kind: `${purpose}-token`,
    description,
    token,
    verify,
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

  // The non-canonical case needs a body whose length leaves unused bits.
  const withUnusedBits = [base, issuedUnlock(pathClaims), issuedUnlock(appClaims)].find(
    ({ token }) => token.slice(V4_PUBLIC_HEADER.length).split('.')[0].length % 4 !== 0
  )
  if (withUnusedBits === undefined) throw new Error('no candidate body with unused bits')

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
      signed: signUnlock(`${canonicalUnlockMessage(baseUnlockClaims).slice(0, -1)},"admin":true}`),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'wildcard_scope_is_rejected',
      description: 'A scope is always exact; "*.example.com" fails the schema.',
      signed: signUnlock({
        ...baseUnlockClaims,
        scope: { kind: 'domain', value: '*.example.com', includeSubdomains: false },
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
      signed: withUnusedBits,
      token: nonCanonicalBody(withUnusedBits.token),
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
    ...moreUnlockVectors(base),
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
        assertion: implicitAssertionText('policy', { issuer: ISSUER, device: DEVICE }),
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

/** Replaces the 32-byte S half of the signature with S + L (same value mod L, non-canonical). */
function addOrderToScalar(token) {
  return mutateBody(token, (bytes) => {
    const offset = bytes.length - 32
    let s = 0n
    for (let index = 31; index >= 0; index--) s = (s << 8n) | BigInt(bytes[offset + index])
    let value = s + L
    for (let index = 0; index < 32; index++) {
      bytes[offset + index] = Number(value & 0xffn)
      value >>= 8n
    }
  })
}

/** Signs an arbitrary message with unlock key A, the default footer and the unlock assertion. */
function signRawUnlock(messageText) {
  return signUnlock(messageText)
}

function moreUnlockVectors(base) {
  const canonical = canonicalUnlockMessage(baseUnlockClaims)
  const subdomains = {
    ...baseUnlockClaims,
    scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: true },
  }
  const leapDay = {
    ...baseUnlockClaims,
    iat: '2028-02-29T09:00:00Z',
    nbf: '2028-02-29T09:00:00Z',
    exp: '2028-02-29T09:30:00Z',
  }
  const fourHours = { ...baseUnlockClaims, exp: shift(baseUnlockClaims.iat, 4 * 3600) }
  const pathScope = (value) => ({ ...baseUnlockClaims, scope: { kind: 'path', value } })
  const smallOrderKey = '0100000000000000000000000000000000000000000000000000000000000000'
  const smallOrderKid = deriveKeyId(Uint8Array.from(Buffer.from(smallOrderKey, 'hex')))
  const footerB64 = base.token.slice(base.token.lastIndexOf('.') + 1)
  const emptyMessage = signUnlock('')

  return [
    vector({
      id: 'valid_unlock_token_with_subdomains_scope',
      description: 'A domain scope with includeSubdomains true verifies (matching is spec §4.5).',
      signed: issuedUnlock(subdomains),
      expect: valid(subdomains),
    }),
    vector({
      id: 'leap_day_in_a_leap_year_is_valid',
      description: '2028-02-29 exists.',
      signed: issuedUnlock(leapDay),
      now: '2028-02-29T09:05:00Z',
      expect: valid(leapDay),
    }),
    vector({
      id: 'leap_day_in_a_common_year_is_rejected',
      description: '2027-02-29 does not exist.',
      signed: signUnlock({
        ...leapDay,
        iat: '2027-02-29T09:00:00Z',
        nbf: '2027-02-29T09:00:00Z',
        exp: '2027-02-29T09:30:00Z',
      }),
      now: '2027-03-01T09:05:00Z',
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'leap_second_is_rejected',
      description: '23:59:60 is never accepted.',
      signed: signUnlock({ ...baseUnlockClaims, iat: '2026-01-04T23:59:60Z' }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'year_before_1970_is_rejected',
      description: 'Years before 1970 fail the pattern.',
      signed: signUnlock({ ...baseUnlockClaims, iat: '1969-12-31T23:59:59Z' }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'nbf_equal_to_exp_is_rejected',
      description: 'nbf < exp is strict.',
      signed: signUnlock({ ...baseUnlockClaims, nbf: baseUnlockClaims.exp }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'unlock_duration_below_sixty_seconds_is_rejected',
      description: 'dur_s 59 fails the schema minimum.',
      signed: signUnlock({ ...baseUnlockClaims, dur_s: 59 }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'unlock_duration_over_120_minutes_is_rejected',
      description: 'dur_s 7201 fails the schema maximum even inside a 4 h token.',
      signed: signUnlock({ ...fourHours, dur_s: 7201 }),
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'domain_scope_without_include_subdomains_is_rejected',
      description: 'includeSubdomains is required on domain scopes.',
      signed: signRawUnlock(canonical.replace(',"includeSubdomains":false', '')),
      expect: invalid('invalid_claims'),
    }),
    ...[
      ['dot', 'forum.example.com/r/.'],
      ['dot_dot', 'forum.example.com/r/../admin'],
      ['percent', 'forum.example.com/r/a%2Fb'],
      ['empty', 'forum.example.com/r//a'],
    ].map(([label, value]) =>
      vector({
        id: `path_scope_with_${label}_segment_is_rejected`,
        description: `Path scopes forbid ".", "..", "%", empty segments and backslashes (${value}).`,
        signed: signUnlock(pathScope(value)),
        expect: invalid('invalid_claims'),
      })
    ),
    vector({
      id: 'path_scope_with_backslash_is_rejected',
      description: 'A backslash cannot appear in a path scope (nor, unescaped, in canonical JSON).',
      signed: signRawUnlock(
        canonical.replace(
          '{"kind":"domain","value":"video.example.com","includeSubdomains":false}',
          '{"kind":"path","value":"forum.example.com/r\\\\a"}'
        )
      ),
      expect: invalid('invalid_claims'),
    }),
    // Canonical serialisation (spec §4.0).
    ...[
      ['version_written_as_1_0', canonical.replace('"v":1,', '"v":1.0,')],
      ['version_written_as_1e0', canonical.replace('"v":1,', '"v":1e0,')],
      ['duplicate_member', `${canonical.slice(0, -1)},"dur_s":7200}`],
      ['whitespace', canonical.replace('"v":1,', '"v": 1,')],
      ['escaped_character', canonical.replace('"typ":"unlock"', '"typ":"\\u0075nlock"')],
      ['escaped_slash', canonical.replace('https://focus', 'https:\\/\\/focus')],
      ['reordered_members', canonical.replace('"v":1,"typ":"unlock",', '"typ":"unlock","v":1,')],
      ['byte_order_mark', `\uFEFF${canonical}`],
    ].map(([label, messageText]) =>
      vector({
        id: `non_canonical_claims_with_${label}_are_rejected`,
        description:
          'Correctly signed, but the message is not the canonical serialisation of its claims.',
        signed: signRawUnlock(messageText),
        expect: invalid('invalid_claims'),
      })
    ),
    // Structure and bytes (spec §1).
    vector({
      id: 'token_over_4096_bytes_is_rejected',
      description: 'A 4097-byte token is refused before anything else is examined.',
      signed: base,
      token: `${V4_PUBLIC_HEADER}${'A'.repeat(4097 - V4_PUBLIC_HEADER.length)}`,
      tampering: 'header followed by "A" up to 4097 bytes',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'token_of_exactly_4096_bytes_passes_the_length_check',
      description: 'At 4096 bytes the length check passes; this one then lacks a footer.',
      signed: base,
      token: `${V4_PUBLIC_HEADER}${'A'.repeat(4096 - V4_PUBLIC_HEADER.length)}`,
      tampering: 'header followed by "A" up to 4096 bytes',
      expect: invalid('malformed_footer'),
    }),
    vector({
      id: 'token_with_trailing_newline_is_rejected',
      description: 'Any byte outside 0x21-0x7E gives malformed_token first.',
      signed: base,
      token: `${base.token}\n`,
      tampering: 'appended a line feed',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'token_with_non_ascii_byte_is_rejected',
      description: 'A non-ASCII character makes the token malformed, even before the header check.',
      signed: base,
      token: `é${base.token}`,
      tampering: 'prefixed U+00E9',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'token_with_three_parts_after_the_header_is_rejected',
      description: 'Only body and footer may follow the header.',
      signed: base,
      token: `${base.token}.${footerB64}`,
      tampering: 'footer part repeated',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'token_with_trailing_dot_is_rejected',
      description: 'An empty part after a trailing "." is not canonical.',
      signed: base,
      token: `${base.token}.`,
      tampering: 'appended "."',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'body_of_63_bytes_is_rejected',
      description: 'The body must hold at least a 64-byte signature.',
      signed: base,
      token: `${V4_PUBLIC_HEADER}${encodeBase64Url(new Uint8Array(63))}.${footerB64}`,
      tampering: 'body replaced with 63 zero bytes',
      expect: invalid('malformed_token'),
    }),
    vector({
      id: 'signed_empty_message_is_rejected',
      description: 'A 64-byte body (a valid signature over an empty message) has no claims.',
      signed: emptyMessage,
      expect: invalid('invalid_claims'),
    }),
    vector({
      id: 'capitalised_header_is_rejected',
      description: 'Header V4.public. is not v4.public.',
      signed: base,
      token: `V4.public.${base.token.slice(V4_PUBLIC_HEADER.length)}`,
      tampering: 'header replaced with V4.public.',
      expect: invalid('wrong_header'),
    }),
    // Footer and keys (spec §2).
    vector({
      id: 'footer_kid_of_15_characters_is_rejected',
      description: 'A kid is exactly 16 characters.',
      signed: base,
      token: replaceFooter(base.token, `{"kid":"${unlockA.kid.slice(0, 15)}"}`),
      tampering: 'kid shortened to 15 characters',
      expect: invalid('malformed_footer'),
    }),
    vector({
      id: 'footer_kid_of_17_characters_is_rejected',
      description: 'A kid is exactly 16 characters.',
      signed: base,
      token: replaceFooter(base.token, `{"kid":"${unlockA.kid}A"}`),
      tampering: 'kid lengthened to 17 characters',
      expect: invalid('malformed_footer'),
    }),
    vector({
      id: 'footer_with_extra_member_is_rejected',
      description: 'The footer has exactly one member.',
      signed: signUnlock(baseUnlockClaims, { footer: `{"kid":"${unlockA.kid}","x":1}` }),
      expect: invalid('malformed_footer'),
    }),
    vector({
      id: 'footer_naming_one_pinned_key_signed_by_the_other_is_rejected',
      description: 'Footer kid is key A, signature is by pinned key B: the named key decides.',
      signed: signUnlock(baseUnlockClaims, { key: unlockB, footer: `{"kid":"${unlockA.kid}"}` }),
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'signature_scalar_plus_group_order_is_rejected',
      description: 'S + L verifies in lenient libraries; the strict policy requires S < L.',
      signed: base,
      token: addOrderToScalar(base.token),
      tampering: 'signature S replaced with S + L',
      expect: invalid('invalid_signature'),
    }),
    vector({
      id: 'small_order_pinned_key_is_refused',
      description:
        'A keyring holding a small-order public key (the identity point) is invalid input.',
      signed: base,
      keyring: [{ kid: smallOrderKid, publicKeyHex: smallOrderKey }],
      expect: invalid('invalid_input'),
    }),
    vector({
      id: 'issuer_with_explicit_port_is_refused',
      description: 'Release issuers are https://host with no port.',
      signed: base,
      issuer: 'https://focus.example.org:443',
      expect: invalid('invalid_input'),
    }),
    vector({
      id: 'plain_http_issuer_is_refused_in_release_profile',
      description: 'Plain http is accepted only for loopback, and only in the development profile.',
      signed: base,
      issuer: 'http://focus.example.org',
      expect: invalid('invalid_input'),
    }),
  ]
}

function issuedTime(claims) {
  const issued = issueTimeToken(claims, { kid: unlockA.kid, secretKey: unlockA.secretKey })
  const signed = signTime(claims)
  if (!issued.ok || issued.value !== signed.token) {
    throw new Error('issueTimeToken and the raw signer disagree')
  }
  return signed
}

function timeVectors() {
  const base = issuedTime(baseTimeClaims)
  const incomplete = { ...baseTimeClaims, complete: false }
  const empty = { ...baseTimeClaims, revoked: [] }
  const many = {
    ...baseTimeClaims,
    revoked: Array.from({ length: 33 }, (_, index) => ({
      jti: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
      exp: '2026-01-05T09:40:00Z',
    })),
  }
  const time = (options) => vector({ purpose: 'time', ...options })
  return [
    time({
      id: 'valid_time_token',
      description: 'A time token answering this nonce and boot, with one revocation.',
      signed: base,
      expect: valid(baseTimeClaims),
    }),
    time({
      id: 'valid_time_token_with_incomplete_revocations',
      description: 'complete false: the client must revalidate every received or active unlock.',
      signed: issuedTime(incomplete),
      expect: valid(incomplete),
    }),
    time({
      id: 'valid_time_token_without_revocations',
      description: 'An empty revocation list is written as [].',
      signed: issuedTime(empty),
      expect: valid(empty),
    }),
    time({
      id: 'time_token_for_other_nonce_fails_implicit_assertion',
      description: 'A recorded answer to an earlier request cannot be replayed.',
      signed: base,
      nonce: OTHER_NONCE,
      expect: invalid('invalid_signature'),
    }),
    time({
      id: 'time_token_for_other_boot_fails_implicit_assertion',
      description: 'An answer for a previous boot cannot anchor this one.',
      signed: base,
      boot: OTHER_BOOT,
      expect: invalid('invalid_signature'),
    }),
    time({
      id: 'time_token_for_other_device_fails_implicit_assertion',
      description: 'An answer for another device does not verify here.',
      signed: base,
      device: OTHER_DEVICE,
      expect: invalid('invalid_signature'),
    }),
    time({
      id: 'time_claims_with_other_nonce_are_rejected',
      description: 'Assertion bound to this nonce but claims naming another (defence in depth).',
      signed: signTime({ ...baseTimeClaims, nonce: OTHER_NONCE }, { nonce: NONCE }),
      expect: invalid('binding_mismatch'),
    }),
    time({
      id: 'unlock_token_presented_as_time_token_is_rejected',
      description: 'Same key, different assertion: an unlock token never anchors time.',
      signed: issuedUnlock(baseUnlockClaims),
      expect: invalid('invalid_signature'),
    }),
    time({
      id: 'unlock_claims_with_time_assertion_fail_typ',
      description: 'Unlock claims signed with the time assertion fail on typ.',
      signed: sign({
        payload: baseUnlockClaims,
        key: unlockA,
        assertion: implicitAssertionText('time', {
          issuer: ISSUER,
          device: DEVICE,
          nonce: NONCE,
          boot: BOOT,
        }),
      }),
      expect: invalid('wrong_typ'),
    }),
    time({
      id: 'time_token_signed_with_policy_key_is_rejected',
      description: 'Time tokens are verified with the unlock keyring only.',
      signed: signTime(baseTimeClaims, { key: policyA }),
      expect: invalid('unknown_kid'),
    }),
    time({
      id: 'time_token_with_33_revocations_is_rejected',
      description:
        'At most 32 revocations fit (the token stays under 4096 bytes); the server sets complete false instead.',
      signed: signTime(many),
      expect: invalid('invalid_claims'),
    }),
    time({
      id: 'time_token_with_whitespace_in_revocations_is_rejected',
      description: 'The revocation list follows the canonical serialisation too.',
      signed: signTime(
        canonicalTimeMessage(baseTimeClaims).replace('"revoked":[{', '"revoked":[ {')
      ),
      expect: invalid('invalid_claims'),
    }),
  ]
}

/** Every vector file as `{ path, content }`, path relative to the package root. */
export function generateVectors() {
  const files = []
  for (const [dir, vectors] of [
    ['fixtures/unlock-tokens', unlockVectors()],
    ['fixtures/policy-tokens', policyVectors()],
    ['fixtures/time-tokens', timeVectors()],
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
