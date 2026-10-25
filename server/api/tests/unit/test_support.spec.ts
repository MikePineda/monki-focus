// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { isJapaProcess } from '#services/japa_process'
import { testSupportAllowed } from '#services/test_support'
import { isLoopbackHost, isLoopbackUrl } from '#http/loopback_address'

const LOOPBACK = { host: '127.0.0.1', appUrl: 'http://127.0.0.1:3434' }

test.group('Test-support routes', () => {
  test('test_node_env_test_alone_never_opens_the_test_routes', ({ assert }) => {
    assert.isFalse(testSupportAllowed({ japaProcess: false, e2eMode: false, ...LOOPBACK }))
  })

  test('test_e2e_mode_or_the_japa_process_open_them_on_loopback_only', ({ assert }) => {
    assert.isTrue(testSupportAllowed({ japaProcess: false, e2eMode: true, ...LOOPBACK }))
    assert.isTrue(testSupportAllowed({ japaProcess: true, e2eMode: false, ...LOOPBACK }))
  })

  test('test_production_e2e_mode_on_all_interfaces_with_a_localhost_url_stays_closed', ({
    assert,
  }) => {
    assert.isFalse(
      testSupportAllowed({
        japaProcess: false,
        e2eMode: true,
        host: '0.0.0.0',
        appUrl: 'http://localhost:3434',
      })
    )
    assert.isFalse(
      testSupportAllowed({
        japaProcess: true,
        e2eMode: true,
        host: '127.0.0.1',
        appUrl: 'https://focus.example.org',
      })
    )
  })

  test('test_the_japa_entrypoint_marks_this_process', ({ assert }) => {
    assert.isTrue(isJapaProcess())
  })
})

test.group('Loopback addresses', () => {
  test('test_loopback_is_localhost_127_slash_8_and_ipv6_one', ({ assert }) => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.8.9.10', '::1', '[::1]']) {
      assert.isTrue(isLoopbackHost(host), host)
    }
    assert.isTrue(isLoopbackHost('::ffff:127.0.0.1'))
  })

  test('test_wildcard_private_and_public_addresses_are_not_loopback', ({ assert }) => {
    for (const host of [
      '0.0.0.0',
      '::',
      '10.0.0.1',
      '192.168.1.2',
      '128.0.0.1',
      'focus.example.org',
      'localhost.example.org',
      '',
    ]) {
      assert.isFalse(isLoopbackHost(host), host)
    }
    assert.isFalse(isLoopbackUrl('not a url'))
    assert.isTrue(isLoopbackUrl('http://[::1]:3434/api'))
  })
})
