// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { rateLimitBucket } from '#http/rate_limit_bucket'

test.group('Rate-limit buckets', () => {
  test('test_ipv4_is_one_bucket_per_address', ({ assert }) => {
    assert.equal(rateLimitBucket('203.0.113.7'), '203.0.113.7')
    assert.notEqual(rateLimitBucket('203.0.113.7'), rateLimitBucket('203.0.113.8'))
  })

  test('test_ipv6_addresses_in_one_slash_64_share_a_bucket', ({ assert }) => {
    const first = rateLimitBucket('2001:db8:1:2:aaaa::1')
    const rotated = rateLimitBucket('2001:0DB8:0001:0002:ffff:eeee:dddd:cccc')

    assert.equal(first, '2001:db8:1:2::/64')
    assert.equal(rotated, first)
    assert.notEqual(rateLimitBucket('2001:db8:1:3::1'), first)
  })

  test('test_compressed_and_embedded_forms_expand_correctly', ({ assert }) => {
    assert.equal(rateLimitBucket('::1'), '0:0:0:0::/64')
    assert.equal(rateLimitBucket('2001:db8::'), '2001:db8:0:0::/64')
    assert.equal(rateLimitBucket('fe80::1%eth0'), 'fe80:0:0:0::/64')
    assert.equal(rateLimitBucket('64:ff9b::192.0.2.33'), '64:ff9b:0:0::/64')
  })

  test('test_ipv4_mapped_ipv6_counts_as_its_ipv4_address', ({ assert }) => {
    assert.equal(rateLimitBucket('::ffff:203.0.113.7'), '203.0.113.7')
  })

  test('test_non_addresses_pass_through', ({ assert }) => {
    assert.equal(rateLimitBucket('unknown'), 'unknown')
  })
})
