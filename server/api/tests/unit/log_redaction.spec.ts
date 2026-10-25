// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { Writable } from 'node:stream'
import app from '@adonisjs/core/services/app'
import { Logger } from '@adonisjs/core/logger'
import { LOG_PRIVACY, LOG_REDACT_CENSOR } from '#logging/log_redaction'
import { exportPkcs8 } from '#domain/keys/signing_key_material'
import { issueTime } from '#domain/unlock/time_token_issuer'
import { SigningKeyError } from '#services/signing_key_store'
import { testOnlyKey } from '#tests/support/test_only_keys'

/** A logger with the exact privacy options of config/logger.ts, writing JSON lines into memory. */
function capturingLogger() {
  const lines: string[] = []
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  const logger = new Logger({ enabled: true, level: 'info', ...LOG_PRIVACY, destination })
  return { logger, output: () => lines.join('') }
}

const SECRET = 'synthetic-sensitive-value'

test.group('Log redaction', () => {
  test('test_the_app_logger_uses_the_privacy_options', ({ assert }) => {
    const appLogger = app.config.get<Record<string, unknown>>('logger.loggers.app')

    assert.strictEqual(appLogger.redact, LOG_PRIVACY.redact)
    assert.strictEqual(appLogger.serializers, LOG_PRIVACY.serializers)
    assert.strictEqual(appLogger.formatters, LOG_PRIVACY.formatters)
  })

  test('test_tokens_codes_capabilities_and_emails_never_reach_the_log', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      {
        token: SECRET,
        code: SECRET,
        capability: SECRET,
        email: SECRET,
        password: SECRET,
        device: { token: SECRET, pairingCode: SECRET },
        body: { input: { code: SECRET, email: SECRET, actionUrl: SECRET } },
      },
      'request handled'
    )

    assert.notInclude(output(), SECRET)
    assert.include(output(), LOG_REDACT_CENSOR)
    assert.include(output(), 'request handled')
  })

  test('test_second_factors_invitation_links_and_hashes_never_reach_the_log', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      {
        recoveryCode: SECRET,
        recovery_codes: [SECRET],
        otpauthUrl: SECRET,
        secret: SECRET,
        totp_secret_encrypted: SECRET,
        invitation: SECRET,
        url: { invitationUrl: SECRET },
        token_hash: SECRET,
        codeHash: SECRET,
        body: { 'recoveryCodes': [SECRET], 'otpauth-url': SECRET },
      },
      'account event'
    )

    assert.notInclude(output(), SECRET)
    assert.include(output(), LOG_REDACT_CENSOR)
  })

  test('test_snake_case_and_other_spellings_are_redacted', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      {
        access_token: SECRET,
        refresh_token: SECRET,
        api_key: SECRET,
        API_KEY: SECRET,
        password_confirmation: SECRET,
        client_secret: SECRET,
        Full_Name: SECRET,
        user: { device_token: SECRET, private_key: SECRET },
      },
      'snake'
    )

    assert.notInclude(output(), SECRET)
  })

  test('test_sensitive_fields_are_redacted_at_any_depth', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      { a: { b: { c: { d: { e: { token: SECRET } } } } }, list: [{ email: SECRET }] },
      'deep'
    )

    assert.notInclude(output(), SECRET)
    assert.include(output(), '"list":[{"email":"[redacted]"}]')
  })

  test('test_headers_are_scrubbed_case_insensitively_wherever_they_are', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      {
        req: {
          headers: { 'Authorization': `Bearer ${SECRET}`, 'COOKIE': SECRET, 'X-Api-Key': SECRET },
        },
        res: { headers: { 'Set-Cookie': [SECRET] } },
        upstream: {
          request: { headers: { 'x-xsrf-token': SECRET, 'proxy-authorization': SECRET } },
        },
        headers: { 'x-api-key': SECRET, 'accept': 'application/json' },
      },
      'headers'
    )

    assert.notInclude(output(), SECRET)
    assert.include(output(), '"accept":"application/json"')
  })

  test('test_error_codes_stay_readable_for_operators', ({ assert }) => {
    const { logger, output } = capturingLogger()
    const error = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' })

    logger.error({ err: error }, 'database unreachable')

    assert.include(output(), '"errorCode":"ECONNREFUSED"')
    assert.include(output(), 'connect refused')
  })

  test('test_driver_and_http_client_error_fields_are_dropped', ({ assert }) => {
    const { logger, output } = capturingLogger()
    // Shapes of a pg/knex unique violation and of an HTTP client error.
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      detail: `Key (email)=(${SECRET}) already exists.`,
      sql: `insert into users (email) values ('${SECRET}')`,
      bindings: [SECRET],
    })
    const httpError = Object.assign(new Error('request failed'), {
      config: { headers: { Authorization: SECRET }, data: SECRET },
      request: { path: `/publish?auth=${SECRET}` },
      response: { data: SECRET },
      cause: Object.assign(new Error('socket hang up'), { detail: SECRET, token: SECRET }),
    })

    logger.error({ err: dbError }, 'insert failed')
    logger.error({ err: httpError }, 'publish failed')

    assert.notInclude(output(), SECRET)
    assert.include(output(), '"errorCode":"23505"')
    assert.include(output(), 'socket hang up')
  })

  test('test_a_code_field_outside_an_error_is_always_censored', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.warn({ attempt: { code: '482913' }, code: 'K7Q2M9XA' }, 'pairing failed')

    assert.notInclude(output(), '482913')
    assert.notInclude(output(), 'K7Q2M9XA')
  })

  test('test_the_callers_object_is_never_mutated', ({ assert }) => {
    const { logger } = capturingLogger()
    const payload = { device: { token: SECRET } }

    logger.info(payload, 'mutation check')

    assert.equal(payload.device.token, SECRET)
  })

  test('test_harmless_fields_are_kept', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info({ job: 'deadman', durationMs: 12, platform: 'android' }, 'tick')

    assert.include(output(), '"job":"deadman"')
    assert.include(output(), '"platform":"android"')
  })
  test('test_signing_keys_tokens_and_nonces_never_reach_the_log', ({ assert }) => {
    const { logger, output } = capturingLogger()
    const material = testOnlyKey('test-key-not-real-unlock-a')
    const pkcs8 = exportPkcs8(material)
    const nonce = 'AAECAwQFBgcICQoLDA0ODw'
    const time = issueTime(
      { deviceUuid: '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5', nonce, boot: '41' },
      [],
      {
        issuer: 'https://focus.example.org',
        profile: 'release',
        signingKey: material,
        now: 1_767_603_600,
      }
    )
    if (!time.ok) throw new Error(time.reason)
    const token = time.value.token

    logger.info(
      {
        privateKey: pkcs8,
        private_key_encrypted: pkcs8,
        secretKey: material.secretKey,
        pkcs8,
        seed: pkcs8,
        signingKey: material,
        key: material,
        token,
        unlockToken: token,
        policy_token: token,
        timeToken: token,
        endorsement: token,
        nonce,
        footer: token,
        response: { timeToken: token, nonce },
        rotation: { kid: material.kid, signingKey: { secretKey: material.secretKey } },
      },
      'tokens issued'
    )
    logger.error(
      { err: new SigningKeyError('undecryptable', `signing key ${material.kid} failed`) },
      'boot'
    )

    assert.notInclude(output(), pkcs8)
    assert.notInclude(output(), pkcs8.slice(-24))
    assert.notInclude(output(), token)
    assert.notInclude(output(), nonce)
    assert.include(output(), material.kid)
    assert.include(output(), 'tokens issued')
  })

  test('test_a_private_key_object_never_serialises_its_secret', ({ assert }) => {
    const { logger, output } = capturingLogger()
    const material = testOnlyKey('test-key-not-real-unlock-a')

    logger.info(
      { material: { kid: material.kid, purpose: material.purpose, k: material.secretKey } },
      'k'
    )

    assert.notInclude(output(), exportPkcs8(material).slice(-24))
    assert.notInclude(
      output(),
      Buffer.from(exportPkcs8(material), 'base64url').subarray(-32).toString('hex')
    )
  })
})
