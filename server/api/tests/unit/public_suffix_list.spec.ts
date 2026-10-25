// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isRegistrableDomain } from '#services/public_suffix_list'

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      import.meta.resolve('@monki-focus/protocol/fixtures/public-suffix/test-public-suffixes.json')
    ),
    'utf8'
  )
) as { cases: { domain: string; registrable: boolean }[] }

test.group('Public Suffix List check', () => {
  test('test_the_full_list_agrees_with_every_shared_case', ({ assert }) => {
    for (const { domain, registrable } of fixture.cases) {
      assert.equal(isRegistrableDomain(domain), registrable, domain)
    }
  })

  test('test_private_section_suffixes_are_never_registrable', ({ assert }) => {
    for (const domain of ['github.io', 'blogspot.com', 'herokuapp.com', 'co.uk', 'com.au']) {
      assert.isFalse(isRegistrableDomain(domain), domain)
    }
    for (const domain of ['example.com.au', 'app.herokuapp.com', 'deep.sub.example.co.uk']) {
      assert.isTrue(isRegistrableDomain(domain), domain)
    }
  })

  test('test_ip_literals_single_labels_and_garbage_are_never_registrable', ({ assert }) => {
    for (const domain of [
      '127.0.0.1',
      '10.0.0.1',
      'localhost',
      'com',
      '',
      '.',
      'example..com',
      'example.com.',
      'Example.com',
    ]) {
      assert.isFalse(isRegistrableDomain(domain), domain)
    }
  })
})
