// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  EMPTY_SYNC_LEDGER,
  planRuleSetSync,
  type SyncLedger,
} from '../../../../src/background/sync/RuleSetSyncPlan'

const LOCAL = 'hash-local'
const SERVER = 'hash-server'
const incoming = { schemaVersion: 1, rules: [] }

function ledger(overrides: Partial<SyncLedger> = {}): SyncLedger {
  return { ...EMPTY_SYNC_LEDGER, revision: 3, syncedHash: LOCAL, ...overrides }
}

describe('planRuleSetSync', () => {
  it('in_sync_heartbeat_does_nothing', () => {
    const plan = planRuleSetSync(LOCAL, ledger(), { kind: 'heartbeat', rulesVersion: 3 })
    expect(plan.step).toEqual({ kind: 'none' })
  })

  it('newer_server_revision_pulls_with_the_applied_revision', () => {
    const plan = planRuleSetSync(LOCAL, ledger(), { kind: 'heartbeat', rulesVersion: 4 })
    expect(plan.step).toEqual({ kind: 'fetch', ifNoneMatch: 3 })
  })

  it('local_edit_pushes_with_if_match_of_the_synced_revision', () => {
    const plan = planRuleSetSync('hash-edited', ledger(), { kind: 'heartbeat', rulesVersion: 3 })
    expect(plan.step).toEqual({ kind: 'push', ifMatch: 3, hash: 'hash-edited' })
  })

  it('server_newer_than_a_local_edit_pulls_before_pushing', () => {
    const plan = planRuleSetSync('hash-edited', ledger(), { kind: 'heartbeat', rulesVersion: 5 })
    expect(plan.step.kind).toBe('fetch')
  })

  it('incoming_set_is_applied_through_the_rule_change_policy', () => {
    const plan = planRuleSetSync(LOCAL, ledger(), {
      kind: 'fetched',
      revision: 4,
      ruleSet: incoming,
      hash: SERVER,
    })
    expect(plan.step).toEqual({ kind: 'apply', revision: 4, ruleSet: incoming, hash: SERVER })
    // Nothing is recorded until the policy accepted it.
    expect(plan.ledger).toEqual(ledger())
  })

  it('applied_set_records_its_revision_and_hash', () => {
    const plan = planRuleSetSync(SERVER, ledger(), { kind: 'applied', revision: 4, hash: SERVER })
    expect(plan.step).toEqual({ kind: 'none' })
    expect(plan.ledger).toMatchObject({ revision: 4, syncedHash: SERVER })
  })

  it('incoming_equal_to_local_only_records_the_revision', () => {
    const plan = planRuleSetSync(LOCAL, ledger(), {
      kind: 'fetched',
      revision: 4,
      ruleSet: incoming,
      hash: LOCAL,
    })
    expect(plan.step).toEqual({ kind: 'none' })
    expect(plan.ledger).toMatchObject({ revision: 4, syncedHash: LOCAL })
  })

  it('empty_server_is_seeded_with_the_local_set', () => {
    const plan = planRuleSetSync(LOCAL, EMPTY_SYNC_LEDGER, {
      kind: 'fetched',
      revision: 0,
      ruleSet: null,
      hash: null,
    })
    expect(plan.step).toEqual({ kind: 'push', ifMatch: 0, hash: LOCAL })
  })

  it('not_modified_pushes_a_pending_local_edit', () => {
    const plan = planRuleSetSync('hash-edited', ledger(), { kind: 'not_modified' })
    expect(plan.step).toEqual({ kind: 'push', ifMatch: 3, hash: 'hash-edited' })
  })

  it('pushed_set_records_the_new_revision', () => {
    const plan = planRuleSetSync('hash-edited', ledger(), {
      kind: 'pushed',
      revision: 4,
      hash: 'hash-edited',
    })
    expect(plan.step).toEqual({ kind: 'none' })
    expect(plan.ledger).toMatchObject({ revision: 4, syncedHash: 'hash-edited' })
  })

  it('stale_revision_refetches_before_pushing', () => {
    const plan = planRuleSetSync('hash-edited', ledger(), { kind: 'conflict', revision: 7 })
    expect(plan.step).toEqual({ kind: 'fetch', ifNoneMatch: null })
  })

  it('refused_set_is_dropped_and_counted', () => {
    const plan = planRuleSetSync('hash-bad', ledger(), { kind: 'refused', hash: 'hash-bad' })
    expect(plan.step).toEqual({ kind: 'none' })
    expect(plan.ledger).toMatchObject({ rejectedHash: 'hash-bad', rejectedCount: 1 })
  })

  it('unchanged_422_is_never_retried', () => {
    const refused = ledger({ rejectedHash: 'hash-bad', rejectedCount: 1 })
    const plan = planRuleSetSync('hash-bad', refused, { kind: 'heartbeat', rulesVersion: 3 })
    expect(plan.step).toEqual({ kind: 'none' })
  })

  it('edited_set_after_a_422_is_pushed_again', () => {
    const refused = ledger({ rejectedHash: 'hash-bad', rejectedCount: 1 })
    const plan = planRuleSetSync('hash-fixed', refused, { kind: 'heartbeat', rulesVersion: 3 })
    expect(plan.step).toEqual({ kind: 'push', ifMatch: 3, hash: 'hash-fixed' })
  })

  it('server_reset_to_an_older_revision_pulls', () => {
    const plan = planRuleSetSync(LOCAL, ledger(), { kind: 'heartbeat', rulesVersion: 0 })
    expect(plan.step.kind).toBe('fetch')
  })
})
