// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  DEFAULT_NTFY_TOPIC_PREFIX,
  NTFY_TOPIC_BYTES,
  isNtfyTopic,
  ntfyTopicFromBytes,
} from '#domain/guardians/ntfy_topic'
import { ntfySubscription } from '#domain/guardians/ntfy_subscription'
import { pairingQrPayload } from '#domain/guardians/pairing_qr_payload'

const TOPIC = 'mf-aaaaaaaaaaaaaaaaaaaaaaaaaa'

test.group('ntfy topic', () => {
  test('test_topic_carries_128_random_bits_under_the_prefix', ({ assert }) => {
    assert.equal(NTFY_TOPIC_BYTES, 16)
    assert.equal(DEFAULT_NTFY_TOPIC_PREFIX, 'mf-')
    const zeros = ntfyTopicFromBytes('mf-', new Uint8Array(16))
    const ones = ntfyTopicFromBytes('mf-', new Uint8Array(16).fill(255))

    assert.equal(zeros, TOPIC)
    assert.match(ones, /^mf-[a-z2-7]{26}$/)
    assert.notEqual(ntfyTopicFromBytes('mf-', Uint8Array.of(1, ...new Uint8Array(15))), zeros)
    assert.throws(() => ntfyTopicFromBytes('mf-', new Uint8Array(15)), RangeError)
  })

  test('test_topic_fits_ntfy_topic_rules', ({ assert }) => {
    const topic = ntfyTopicFromBytes('self_host-', new Uint8Array(16).fill(7))

    assert.isTrue(isNtfyTopic(topic))
    assert.isAtMost(topic.length, 64)
    assert.throws(() => ntfyTopicFromBytes('bad/prefix', new Uint8Array(16)), RangeError)
    assert.isFalse(isNtfyTopic('mf-has space'))
    assert.isFalse(isNtfyTopic('x'.repeat(65)))
  })
})

test.group('ntfy subscription', () => {
  test('test_subscription_links_point_at_the_topic_on_the_public_server', ({ assert }) => {
    assert.deepEqual(ntfySubscription('https://ntfy.example.org/', TOPIC), {
      topic: TOPIC,
      url: `https://ntfy.example.org/${TOPIC}`,
      deepLink: `ntfy://ntfy.example.org/${TOPIC}`,
      qrPayload: `https://ntfy.example.org/${TOPIC}`,
    })
  })

  test('test_a_plain_http_server_gets_an_insecure_deep_link', ({ assert }) => {
    const subscription = ntfySubscription('http://127.0.0.1:8443/push', TOPIC)

    assert.equal(subscription.url, `http://127.0.0.1:8443/push/${TOPIC}`)
    assert.equal(subscription.deepLink, `ntfy://127.0.0.1:8443/push/${TOPIC}?secure=false`)
  })
})

test.group('Pairing QR payload', () => {
  test('test_qr_encodes_only_the_server_url_and_the_code', ({ assert }) => {
    const payload = pairingQrPayload('https://focus.example.org', '012345')
    const url = new URL(payload)

    assert.equal(payload, 'https://focus.example.org/pair#012345')
    assert.equal(url.origin, 'https://focus.example.org')
    assert.equal(url.search, '')
    assert.equal(url.hash, '#012345')
    assert.equal(url.username + url.password, '')
  })

  test('test_qr_payload_keeps_a_path_prefix_of_the_server_url', ({ assert }) => {
    assert.equal(
      pairingQrPayload('https://example.org/focus/', '999999'),
      'https://example.org/focus/pair#999999'
    )
    assert.throws(() => pairingQrPayload('https://example.org', 'abc'), RangeError)
  })
})
