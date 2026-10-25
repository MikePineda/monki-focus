// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { parse } from 'yaml'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import {
  adoptEndorsedKey,
  decodeBase64Url,
  deriveKeyId,
  parseRfc3339Utc,
} from '@monki-focus/protocol'
import { SIGNING_KEYS_TABLE } from '#services/signing_key_store'
import { tokenIssuerIdentity } from '#services/token_issuer_identity'

const NOW = parseRfc3339Utc('2026-01-05T09:00:00Z')!
const CLIENT_VERSION = 'chrome_extension/0.1.0'

interface PublishedKey {
  kid: string
  purpose: 'unlock' | 'policy'
  x: string
  status: string
  endorsement?: string
}

/**
 * Validates against openapi.yaml's `KeySet`. The test instance's issuer is
 * a loopback http origin (development profile), which the release pattern
 * of `KeySet.issuer` refuses on purpose, so only that one member is checked
 * separately.
 */
function keySetValidator() {
  const spec = parse(
    readFileSync(fileURLToPath(import.meta.resolve('@monki-focus/protocol/openapi.yaml')), 'utf8')
  ) as { components: { schemas: Record<string, Record<string, unknown>> } }
  const schemas = structuredClone(spec.components.schemas)
  const keySet = schemas.KeySet as { properties: Record<string, unknown> }
  keySet.properties.issuer = { type: 'string' }
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  ajv.addSchema({ $id: 'urn:monki-focus:openapi', components: { schemas } })
  return ajv.compile({ $ref: 'urn:monki-focus:openapi#/components/schemas/KeySet' })
}

async function bootKeys() {
  const keys = await app.container.make('signingKeys')
  await keys.ensureKeys(NOW)
  return keys
}

test.group('GET /api/v1/keys', () => {
  test('test_keys_lists_one_public_key_per_purpose_matching_the_contract', async ({
    client,
    assert,
  }) => {
    await bootKeys()

    const response = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)

    response.assertStatus(200)
    const body = response.body() as { issuer: string; keys: PublishedKey[] }
    const validate = keySetValidator()
    assert.isTrue(validate(body), JSON.stringify(validate.errors))
    assert.isFalse(validate({ ...body, keys: [{ ...body.keys[0], d: 'x' }] }))
    assert.equal(body.issuer, tokenIssuerIdentity().issuer)
    assert.deepEqual(
      body.keys.map((key) => [key.purpose, key.status]),
      [
        ['unlock', 'active'],
        ['policy', 'active'],
      ]
    )
    for (const key of body.keys) {
      assert.equal(deriveKeyId(decodeBase64Url(key.x)!), key.kid)
      assert.notProperty(key, 'endorsement')
    }
  })

  test('test_keys_never_exposes_private_material', async ({ client, assert }) => {
    await bootKeys()
    const rows = await db.from(SIGNING_KEYS_TABLE).select('private_key_encrypted')

    const response = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)

    const text = JSON.stringify(response.body())
    assert.notMatch(text, /private|secret|pkcs8|"d":/i)
    for (const row of rows) assert.notInclude(text, row.private_key_encrypted)
  })

  test('test_keys_sends_an_etag_and_answers_304_when_it_matches', async ({ client, assert }) => {
    await bootKeys()

    const first = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)
    const etag = first.header('etag') ?? ''
    assert.match(etag, /^"[A-Za-z0-9_-]{27}"$/)
    assert.equal(first.header('cache-control'), 'public, max-age=300')
    assert.isUndefined(first.header('set-cookie'))

    const again = await client
      .get('/api/v1/keys')
      .header('X-Client-Version', CLIENT_VERSION)
      .header('If-None-Match', etag)
    again.assertStatus(304)
    assert.isUndefined(again.header('set-cookie'))
  })

  test('test_keys_publishes_the_retired_key_and_an_endorsement_that_verifies_after_rotation', async ({
    client,
    assert,
  }) => {
    const keys = await bootKeys()
    const before = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)
    const old = (before.body().keys as PublishedKey[]).find((key) => key.purpose === 'unlock')!

    await keys.rotate('unlock', NOW + 60, tokenIssuerIdentity(), {
      successor: 'generate',
      endorse: true,
    })
    const after = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)

    assert.notEqual(after.header('etag'), before.header('etag'))
    const unlockKeys = (after.body().keys as PublishedKey[]).filter(
      (key) => key.purpose === 'unlock'
    )
    assert.deepEqual(
      unlockKeys.map((key) => key.status),
      ['active', 'retired']
    )
    assert.equal(unlockKeys[1].kid, old.kid)
    const adopted = adoptEndorsedKey(
      'unlock',
      [{ kid: old.kid, publicKey: decodeBase64Url(old.x)! }],
      unlockKeys[0].endorsement,
      { issuer: after.body().issuer, now: NOW + 120, issuerProfile: 'development' }
    )
    assert.isTrue(adopted.ok)
    if (adopted.ok) {
      assert.deepEqual(
        adopted.value.pinned.map((key) => key.kid),
        [old.kid, unlockKeys[0].kid]
      )
    }
    assert.isTrue(keySetValidator()(after.body()))
  })

  test('test_keys_needs_a_client_version_like_every_device_route', async ({ client }) => {
    await bootKeys()

    const missing = await client.get('/api/v1/keys')
    missing.assertStatus(422)
    missing.assertBody({ code: 'validation_failed', fields: { 'X-Client-Version': 'invalid' } })
  })

  test('test_keys_sets_no_cookie_and_keeps_the_security_headers', async ({ client, assert }) => {
    await bootKeys()

    const response = await client.get('/api/v1/keys').header('X-Client-Version', CLIENT_VERSION)

    response.assertStatus(200)
    assert.isUndefined(response.header('set-cookie'))
    assert.deepEqual(response.cookies(), {})
    response.assertHeader('x-frame-options', 'DENY')
    response.assertHeader('x-content-type-options', 'nosniff')
    assert.include(String(response.header('content-security-policy')), `default-src 'self'`)
  })

  test('test_no_api_route_outside_the_dashboard_sets_a_cookie', async ({ client, assert }) => {
    for (const path of ['/api/health', '/api/health/live', '/api/v1/device/unknown']) {
      const response = await client.get(path).header('X-Client-Version', CLIENT_VERSION)
      assert.isUndefined(response.header('set-cookie'), path)
    }
  })
})
