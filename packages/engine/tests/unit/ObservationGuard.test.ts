// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Observation } from '@monki-focus/rules'
import { decide } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeRuleset, makeState } from '../factories/RulesetFactory.ts'

const NOW = '2026-10-26T10:00:00Z'
const FAIL_CLOSED = {
  access: 'block',
  content: 'hide-feed',
  ruleId: null,
  reason: 'engine_error',
  explanationKey: 'decision.engine_error',
}

function decideOn(observation: unknown) {
  return decide(makeRuleset(), observation as Observation, makeState(), NOW, fixtureCatalog())
}

describe('observation guard (SEMANTICS.md §14: schema-invalid input fails closed)', () => {
  it('empty_url_text_fails_closed', () => {
    expect(decideOn({ kind: 'site', urlText: '' })).toEqual(FAIL_CLOSED)
  })

  it('oversized_url_text_fails_closed', () => {
    const urlText = `https://news.example.org/${'a'.repeat(2049 - 25)}`
    expect(urlText).toHaveLength(2049)
    expect(decideOn({ kind: 'site', urlText })).toEqual(FAIL_CLOSED)
    expect(decideOn({ kind: 'site', urlText: urlText.slice(0, 2048) })).toMatchObject({
      reason: 'no_rule',
    })
  })

  it('malformed_package_fails_closed', () => {
    for (const appPackage of [
      'not a package',
      'single',
      '.com.example',
      'a'.repeat(250) + '.b.c.d',
    ]) {
      expect(decideOn({ kind: 'app', package: appPackage, surface: null })).toEqual(FAIL_CLOSED)
    }
    expect(decideOn({ kind: 'app', package: 'com.example.reader', surface: null })).toMatchObject({
      reason: 'no_rule',
    })
  })

  it('malformed_app_surface_fails_closed', () => {
    for (const surface of ['Not.A.Surface', 42, undefined, `a.${'b'.repeat(70)}`]) {
      expect(decideOn({ kind: 'app', package: 'com.example.reader', surface })).toEqual(FAIL_CLOSED)
    }
    expect(
      decideOn({ kind: 'app', package: 'com.example.reader', surface: 'youtube.shorts' })
    ).toMatchObject({ reason: 'no_rule' })
  })

  it('an_observation_with_unknown_fields_fails_closed', () => {
    expect(decideOn({ kind: 'site', urlText: 'news.example.org', title: 'x' })).toEqual(FAIL_CLOSED)
    expect(
      decideOn({ kind: 'app', package: 'com.example.reader', surface: null, url: 'x' })
    ).toEqual(FAIL_CLOSED)
  })
})
