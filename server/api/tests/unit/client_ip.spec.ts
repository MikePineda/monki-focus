// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { resolveClientIp } from '#http/client_ip'

/**
 * Fake context: `peer` is the TCP peer (the reverse proxy in production),
 * `ip` what `request.ip()` resolved through the trusted-proxy rules.
 */
function ctxWith(headers: Record<string, string>, peer: string, ip = peer) {
  return {
    request: {
      header: (name: string) => headers[name.toLowerCase()],
      ip: () => ip,
      request: { socket: { remoteAddress: peer } },
    },
  }
}

const CDN_HEADER = 'cf-connecting-ip'

test.group('Client IP', () => {
  test('test_configured_header_wins_when_the_peer_is_a_local_proxy', ({ assert }) => {
    const viaDockerProxy = ctxWith(
      { [CDN_HEADER]: '203.0.113.7', 'x-forwarded-for': '198.51.100.66' },
      '10.0.1.5',
      '198.51.100.1'
    )

    assert.equal(resolveClientIp(viaDockerProxy, CDN_HEADER), '203.0.113.7')
    assert.equal(
      resolveClientIp(ctxWith({ [CDN_HEADER]: '203.0.113.7' }, '127.0.0.1'), CDN_HEADER),
      '203.0.113.7'
    )
    assert.equal(
      resolveClientIp(ctxWith({ [CDN_HEADER]: '2001:db8::7' }, '::ffff:172.18.0.4'), CDN_HEADER),
      '2001:db8::7'
    )
  })

  test('test_header_from_a_direct_public_peer_is_ignored', ({ assert }) => {
    const direct = ctxWith({ [CDN_HEADER]: '198.51.100.99' }, '198.51.100.20')

    assert.equal(resolveClientIp(direct, CDN_HEADER), '198.51.100.20')
  })

  test('test_spoofed_headers_from_one_public_peer_share_one_bucket', ({ assert }) => {
    const first = ctxWith({ [CDN_HEADER]: '192.0.2.1' }, '198.51.100.20')
    const second = ctxWith({ [CDN_HEADER]: '192.0.2.2' }, '198.51.100.20')

    assert.equal(resolveClientIp(first, CDN_HEADER), resolveClientIp(second, CDN_HEADER))
  })

  test('test_without_a_configured_header_the_trusted_proxy_resolution_wins', ({ assert }) => {
    const viaProxy = ctxWith({ [CDN_HEADER]: '203.0.113.7' }, '10.0.1.5', '198.51.100.20')

    assert.equal(resolveClientIp(viaProxy, undefined), '198.51.100.20')
  })

  test('test_blank_list_or_garbage_header_values_are_ignored', ({ assert }) => {
    for (const value of ['  ', '203.0.113.7, 10.0.0.1', 'unknown', '203.0.113.7:443']) {
      const ctx = ctxWith({ 'x-real-ip': value }, '127.0.0.1', '127.0.0.1')
      assert.equal(resolveClientIp(ctx, 'x-real-ip'), '127.0.0.1', value)
    }
  })
})
