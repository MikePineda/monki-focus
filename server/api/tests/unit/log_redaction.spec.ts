// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { Writable } from 'node:stream'
import { Logger } from '@adonisjs/core/logger'
import { LOG_REDACT_CENSOR, logRedaction, logSerializers } from '#logging/log_redaction'

/** A logger configured like config/logger.ts, writing JSON lines into memory. */
function capturingLogger() {
  const lines: string[] = []
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  const logger = new Logger({
    enabled: true,
    level: 'info',
    redact: logRedaction,
    serializers: logSerializers,
    destination,
  })
  return { logger, output: () => lines.join('') }
}

const SECRET_MARK = 'synthetic-sensitive-value'

test.group('Log redaction', () => {
  test('test_tokens_codes_capabilities_and_emails_never_reach_the_log', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info(
      {
        token: SECRET_MARK,
        code: SECRET_MARK,
        capability: SECRET_MARK,
        email: SECRET_MARK,
        password: SECRET_MARK,
        device: { token: SECRET_MARK, pairingCode: SECRET_MARK },
        body: { input: { code: SECRET_MARK, email: SECRET_MARK, actionUrl: SECRET_MARK } },
        req: { headers: { authorization: `Bearer ${SECRET_MARK}`, cookie: SECRET_MARK } },
        res: { headers: { 'set-cookie': SECRET_MARK } },
      },
      'request handled'
    )

    assert.notInclude(output(), SECRET_MARK)
    assert.include(output(), LOG_REDACT_CENSOR)
    assert.include(output(), 'request handled')
  })

  test('test_error_codes_stay_readable_for_operators', ({ assert }) => {
    const { logger, output } = capturingLogger()
    const error = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' })

    logger.error({ err: error }, 'database unreachable')

    assert.include(output(), '"errorCode":"ECONNREFUSED"')
    assert.include(output(), 'connect refused')
  })

  test('test_a_code_field_outside_an_error_is_always_censored', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.warn({ attempt: { code: '482913' }, code: 'K7Q2M9XA' }, 'pairing failed')

    assert.notInclude(output(), '482913')
    assert.notInclude(output(), 'K7Q2M9XA')
  })

  test('test_harmless_fields_are_kept', ({ assert }) => {
    const { logger, output } = capturingLogger()

    logger.info({ job: 'deadman', durationMs: 12, platform: 'android' }, 'tick')

    assert.include(output(), '"job":"deadman"')
    assert.include(output(), '"platform":"android"')
  })
})
