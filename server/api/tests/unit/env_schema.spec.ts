// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { Secret } from '@adonisjs/core/helpers'
import { crossFieldProblems, envSchema } from '#start/env_schema'
import { exportPkcs8 } from '#domain/keys/signing_key_material'
import { testOnlyKey } from '#tests/support/test_only_keys'

/** Runs one variable's validator the way Env.create does at boot. */
function validate<Name extends keyof typeof envSchema>(name: Name, value: string | undefined) {
  return envSchema[name](name, value) as ReturnType<(typeof envSchema)[Name]>
}

test.group('Environment schema', () => {
  test('test_boot_fails_without_the_required_variables', ({ assert }) => {
    for (const name of [
      'NODE_ENV',
      'HOST',
      'PORT',
      'LOG_LEVEL',
      'APP_KEY',
      'APP_URL',
      'SESSION_DRIVER',
      'LIMITER_STORE',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_DATABASE',
    ] as const) {
      assert.throws(() => validate(name, undefined), Error, /./, name)
    }
  })

  test('test_secrets_are_typed_as_secret_and_never_print', ({ assert }) => {
    for (const name of [
      'APP_KEY',
      'DB_PASSWORD',
      'SEED_ADMIN_PASSWORD',
      'SMOKE_PASSWORD',
      'SMOKE_DEVICE_TOKEN',
      'UNLOCK_SIGNING_KEY',
      'NTFY_PUBLISH_TOKEN',
      'LLM_API_KEY',
      'REDDIT_CLIENT_SECRET',
      'SENTRY_DSN',
    ] as const) {
      const value = validate(name, 'synthetic-value-for-the-test')
      assert.instanceOf(value, Secret, name)
      assert.notInclude(String(value), 'synthetic-value', name)
      assert.notInclude(JSON.stringify({ value }), 'synthetic-value', name)
    }
  })

  test('test_optional_variables_default_to_nothing', ({ assert }) => {
    for (const name of [
      'SOURCE_URL',
      'CLIENT_IP_HEADER',
      'SEED_ADMIN_EMAIL',
      'NTFY_BASE_URL',
      'NTFY_PUBLIC_URL',
      'MIN_CLIENT_VERSION_ANDROID',
      'UNLOCK_TOKEN_MAX_MINUTES',
      'LLM_API_KEY',
    ] as const) {
      assert.isUndefined(validate(name, undefined), name)
      assert.isUndefined(validate(name, ''), name)
    }
  })

  test('test_unlock_tokens_cannot_outlive_four_hours', ({ assert }) => {
    assert.equal(validate('UNLOCK_TOKEN_MAX_MINUTES', '240'), 240)
    assert.throws(() => validate('UNLOCK_TOKEN_MAX_MINUTES', '241'), /1 to 240/)
    assert.throws(() => validate('UNLOCK_TOKEN_MAX_MINUTES', '0'))
    assert.throws(() => validate('UNLOCK_TOKEN_MAX_MINUTES', '90.5'))
    assert.throws(() => validate('DEADMAN_DEFAULT_HOURS', '49'))
  })

  test('test_minimum_client_versions_must_be_semver', ({ assert }) => {
    assert.equal(validate('MIN_CLIENT_VERSION_EXTENSION', '1.4.0'), '1.4.0')
    assert.equal(validate('MIN_CLIENT_VERSION_MACOS', '0.3.0-beta.2'), '0.3.0-beta.2')
    assert.throws(() => validate('MIN_CLIENT_VERSION_ANDROID', '1.4'), /semantic version/)
    assert.throws(() => validate('MIN_CLIENT_VERSION_ANDROID', 'v1.4.0'))
  })

  test('test_client_ip_header_is_a_lowercased_header_name', ({ assert }) => {
    assert.equal(validate('CLIENT_IP_HEADER', 'CF-Connecting-IP'), 'cf-connecting-ip')
    assert.throws(() => validate('CLIENT_IP_HEADER', 'x real ip'), /header name/)
    assert.throws(() => validate('CLIENT_IP_HEADER', 'x-real-ip:'))
  })

  test('test_urls_and_emails_are_validated', ({ assert }) => {
    assert.equal(validate('APP_URL', 'http://localhost:3433'), 'http://localhost:3433')
    assert.throws(() => validate('APP_URL', 'not a url'))
    assert.throws(() => validate('NTFY_BASE_URL', 'ntfy'))
    assert.throws(() => validate('SEED_ADMIN_EMAIL', 'not-an-email'))
    assert.equal(validate('SEED_ADMIN_EMAIL', 'admin@example.org'), 'admin@example.org')
  })

  test('test_ntfy_topic_prefix_is_url_safe', ({ assert }) => {
    assert.equal(validate('NTFY_TOPIC_PREFIX', 'mf-'), 'mf-')
    assert.throws(() => validate('NTFY_TOPIC_PREFIX', 'mf/'))
    assert.throws(() => validate('NTFY_TOPIC_PREFIX', 'a'.repeat(17)))
  })

  test('test_boot_is_refused_for_e2e_mode_on_all_interfaces_even_with_a_loopback_url', ({
    assert,
  }) => {
    const problems = crossFieldProblems({
      NODE_ENV: 'production',
      E2E_MODE: true,
      HOST: '0.0.0.0',
      APP_URL: 'http://localhost:3434',
    })

    assert.lengthOf(problems, 1)
    assert.match(problems[0], /loopback HOST and APP_URL/)
  })

  test('test_test_grade_settings_need_loopback_host_and_url_whatever_node_env_says', ({
    assert,
  }) => {
    const refused = [
      { NODE_ENV: 'test', HOST: '0.0.0.0', APP_URL: 'http://127.0.0.1:3333' },
      { NODE_ENV: 'test', HOST: '127.0.0.1', APP_URL: 'https://focus.example.org' },
      { NODE_ENV: 'development', E2E_MODE: true, HOST: '::', APP_URL: 'http://[::1]:3434' },
      { NODE_ENV: 'production', E2E_MODE: true, HOST: '10.0.0.5', APP_URL: 'http://127.0.0.1' },
    ]
    for (const values of refused) {
      assert.lengthOf(crossFieldProblems(values), 1, JSON.stringify(values))
    }

    const accepted = [
      { NODE_ENV: 'test', HOST: '127.0.0.1', APP_URL: 'http://127.0.0.1:3333' },
      { NODE_ENV: 'production', E2E_MODE: true, HOST: '::1', APP_URL: 'http://[::1]:3434' },
      { NODE_ENV: 'test', E2E_MODE: true, HOST: 'localhost', APP_URL: 'http://127.0.0.2:3434' },
      { NODE_ENV: 'production', HOST: '0.0.0.0', APP_URL: 'https://focus.example.org' },
    ]
    for (const values of accepted) {
      assert.lengthOf(crossFieldProblems(values), 0, JSON.stringify(values))
    }
  })

  test('test_client_ip_header_sources_are_cidrs_or_addresses', ({ assert }) => {
    assert.equal(
      validate('CLIENT_IP_HEADER_FROM', ' 203.0.113.0/24, 2001:db8::/32 '),
      '203.0.113.0/24, 2001:db8::/32'
    )
    assert.isUndefined(validate('CLIENT_IP_HEADER_FROM', '  '))
    for (const bad of ['loopback', '203.0.113.0/33', 'example.org', '203.0.113.0/24;rm']) {
      assert.throws(() => validate('CLIENT_IP_HEADER_FROM', bad), /CLIENT_IP_HEADER_FROM/, bad)
    }
  })
  test('test_unlock_signing_key_and_its_kid_go_together_and_never_print', ({ assert }) => {
    const key = testOnlyKey('test-key-not-real-unlock-a')
    const other = testOnlyKey('test-key-not-real-unlock-b')
    const base = { NODE_ENV: 'production', HOST: '0.0.0.0', APP_URL: 'https://focus.example.org' }
    const pkcs8 = exportPkcs8(key)

    assert.lengthOf(crossFieldProblems({ ...base }), 0)
    assert.lengthOf(
      crossFieldProblems({ ...base, UNLOCK_SIGNING_KEY: pkcs8, UNLOCK_SIGNING_KEY_ID: key.kid }),
      0
    )
    for (const values of [
      { UNLOCK_SIGNING_KEY: pkcs8 },
      { UNLOCK_SIGNING_KEY_ID: key.kid },
      { UNLOCK_SIGNING_KEY: pkcs8, UNLOCK_SIGNING_KEY_ID: other.kid },
      { UNLOCK_SIGNING_KEY: `${pkcs8.slice(0, -4)}AAAA`, UNLOCK_SIGNING_KEY_ID: key.kid },
    ]) {
      const problems = crossFieldProblems({ ...base, ...values })
      assert.lengthOf(problems, 1, Object.keys(values).join('+'))
      assert.match(problems[0], /UNLOCK_SIGNING_KEY/)
      assert.notInclude(problems[0], pkcs8.slice(-24))
    }
  })
})
