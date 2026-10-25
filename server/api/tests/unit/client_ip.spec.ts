// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { resolveClientIp } from '#http/client_ip'
import { addressMatcher, parseAddressRanges } from '#http/address_ranges'

/** Fake context: `hop` is what `request.ip()` resolved (the CDN edge as Traefik saw it). */
function ctxWith(headers: Record<string, string>, hop: string) {
  return {
    request: {
      header: (name: string) => headers[name.toLowerCase()],
      ip: () => hop,
    },
  }
}

const CDN_HEADER = 'cf-connecting-ip'
/** Documentation ranges standing in for a CDN's published edge ranges. */
const CDN_RANGES = addressMatcher(parseAddressRanges('198.51.100.0/24, 2001:db8:c::/48'))
const POLICY = { header: CDN_HEADER, trustedFrom: CDN_RANGES }

test.group('Client IP', () => {
  test('test_header_is_trusted_when_the_forwarded_hop_is_inside_the_cdn_ranges', ({ assert }) => {
    assert.equal(
      resolveClientIp(ctxWith({ [CDN_HEADER]: '203.0.113.7' }, '198.51.100.20'), POLICY),
      '203.0.113.7'
    )
    assert.equal(
      resolveClientIp(ctxWith({ [CDN_HEADER]: '2001:db8:1::7' }, '2001:db8:c::9'), POLICY),
      '2001:db8:1::7'
    )
  })

  test('test_header_from_a_hop_outside_the_ranges_is_ignored', ({ assert }) => {
    // A request that reached the proxy without the CDN (or a private peer) forging the header.
    for (const hop of ['192.0.2.20', '10.0.1.5', '127.0.0.1']) {
      assert.equal(resolveClientIp(ctxWith({ [CDN_HEADER]: '203.0.113.99' }, hop), POLICY), hop)
    }
  })

  test('test_spoofed_headers_from_one_direct_client_share_one_bucket', ({ assert }) => {
    const first = ctxWith({ [CDN_HEADER]: '192.0.2.1' }, '192.0.2.50')
    const second = ctxWith({ [CDN_HEADER]: '192.0.2.2' }, '192.0.2.50')

    assert.equal(resolveClientIp(first, POLICY), resolveClientIp(second, POLICY))
  })

  test('test_empty_header_sources_never_trust_the_header', ({ assert }) => {
    const policy = { header: CDN_HEADER, trustedFrom: addressMatcher(parseAddressRanges('')) }

    assert.equal(
      resolveClientIp(ctxWith({ [CDN_HEADER]: '203.0.113.7' }, '198.51.100.20'), policy),
      '198.51.100.20'
    )
  })

  test('test_without_a_configured_header_the_forwarded_hop_wins', ({ assert }) => {
    const ctx = ctxWith({ [CDN_HEADER]: '203.0.113.7' }, '198.51.100.20')

    assert.equal(resolveClientIp(ctx, { trustedFrom: CDN_RANGES }), '198.51.100.20')
  })

  test('test_blank_list_or_garbage_header_values_are_ignored', ({ assert }) => {
    for (const value of ['  ', '203.0.113.7, 10.0.0.1', 'unknown', '203.0.113.7:443']) {
      const ctx = ctxWith({ [CDN_HEADER]: value }, '198.51.100.20')
      assert.equal(resolveClientIp(ctx, POLICY), '198.51.100.20', value)
    }
  })
})
