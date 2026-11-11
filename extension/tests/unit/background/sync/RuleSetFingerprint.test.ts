// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { ruleSetFingerprint } from '../../../../src/background/sync/RuleSetFingerprint'
import { makeRule, makeRuleset } from '../../../factories/makeRuleset'

describe('ruleSetFingerprint', () => {
  it('editor_revision_and_time_never_change_the_fingerprint', async () => {
    const a = await ruleSetFingerprint(
      makeRuleset({ revision: 1, updatedAt: '2026-10-01T00:00:00Z' })
    )
    const b = await ruleSetFingerprint(
      makeRuleset({ revision: 9, updatedAt: '2026-11-01T00:00:00Z', pendingTimeZone: 'UTC' })
    )
    expect(a).toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('key_order_never_changes_the_fingerprint', async () => {
    expect(await ruleSetFingerprint({ a: 1, b: [{ y: 2, x: 1 }] })).toBe(
      await ruleSetFingerprint({ b: [{ x: 1, y: 2 }], a: 1 })
    )
  })

  it('a_changed_rule_changes_the_fingerprint', async () => {
    const before = await ruleSetFingerprint(makeRuleset())
    const after = await ruleSetFingerprint(makeRuleset({ rules: [makeRule({ mode: 'block' })] }))
    expect(after).not.toBe(before)
  })
})
