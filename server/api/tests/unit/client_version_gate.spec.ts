// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { judgeClientVersion } from '#domain/clients/client_version_gate'
import { compareSemanticVersions, parseSemanticVersion } from '#domain/clients/semantic_version'

function compare(a: string, b: string) {
  return Math.sign(compareSemanticVersions(parseSemanticVersion(a)!, parseSemanticVersion(b)!))
}

test.group('Semantic versions', () => {
  test('test_versions_order_by_major_minor_patch_numerically', ({ assert }) => {
    assert.equal(compare('0.10.0', '0.9.9'), 1)
    assert.equal(compare('1.0.0', '1.0.0'), 0)
    assert.equal(compare('1.2.3', '1.10.0'), -1)
  })

  test('test_a_prerelease_is_older_than_its_release', ({ assert }) => {
    assert.equal(compare('1.0.0-beta.2', '1.0.0'), -1)
    assert.equal(compare('1.0.0-alpha', '1.0.0-alpha.1'), -1)
    assert.equal(compare('1.0.0-beta.2', '1.0.0-beta.11'), -1)
    assert.equal(compare('1.0.0-rc.1', '1.0.0-beta.11'), 1)
  })

  test('test_malformed_versions_do_not_parse', ({ assert }) => {
    for (const text of ['1.0', 'v1.0.0', '1.0.0.0', '', '1.0.0-', '01x.0.0']) {
      assert.isNull(parseSemanticVersion(text), text)
    }
  })
})

test.group('Client version gate', () => {
  const minimums = { android: '0.3.0', chrome_extension: '1.0.0' }

  test('test_client_at_or_above_the_minimum_is_accepted', ({ assert }) => {
    assert.deepEqual(judgeClientVersion('android/0.3.0', minimums), {
      kind: 'accepted',
      platform: 'android',
      version: '0.3.0',
    })
    assert.equal(judgeClientVersion('chrome_extension/1.2.0', minimums).kind, 'accepted')
  })

  test('test_client_below_the_minimum_must_upgrade', ({ assert }) => {
    assert.deepEqual(judgeClientVersion('android/0.2.9', minimums), {
      kind: 'upgrade_required',
      platform: 'android',
      minimumVersion: '0.3.0',
    })
    assert.equal(judgeClientVersion('android/0.3.0-beta.1', minimums).kind, 'upgrade_required')
  })

  test('test_platform_without_a_minimum_accepts_any_version', ({ assert }) => {
    assert.equal(judgeClientVersion('macos/0.0.1', minimums).kind, 'accepted')
    assert.equal(judgeClientVersion('other/0.0.1', minimums).kind, 'accepted')
  })

  test('test_missing_or_malformed_header_is_invalid', ({ assert }) => {
    for (const header of [
      undefined,
      null,
      '',
      'android',
      'android/',
      'android/1.0',
      'windows/1.0.0',
      '/1.0.0',
      `android/1.0.0-${'x'.repeat(60)}`,
    ]) {
      assert.deepEqual(judgeClientVersion(header, minimums), { kind: 'invalid' }, String(header))
    }
  })
})
