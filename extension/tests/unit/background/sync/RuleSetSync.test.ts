// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { PendingRuleChangeStore } from '../../../../src/background/rules/PendingRuleChangeStore'
import { RuleChangeService } from '../../../../src/background/rules/RuleChangeService'
import { RULESET_KEY, RulesetStore } from '../../../../src/background/rules/RulesetStore'
import { ruleSetFingerprint } from '../../../../src/background/sync/RuleSetFingerprint'
import { RuleSetSync } from '../../../../src/background/sync/RuleSetSync'
import { EMPTY_SYNC_LEDGER } from '../../../../src/background/sync/RuleSetSyncPlan'
import type {
  HeartbeatBody,
  RuleSetRead,
  RuleSetWriteResult,
} from '../../../../src/background/sync/ServerClient'
import { ServerConnectionStore } from '../../../../src/background/sync/ServerConnectionStore'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { validateRuleset } from '../../../../src/shared/RulesetValidation'
import { makeRule, makeRuleset } from '../../../factories/makeRuleset'
import { ManualClock } from '../../../support/ManualClock'

const TOKEN = `mfd_abc.${'s'.repeat(40)}`

class FakeServer {
  heartbeats: HeartbeatBody[] = []
  puts: { ruleSet: unknown; ifMatch: number }[] = []
  constructor(
    public revision: number,
    public ruleSet: unknown
  ) {}

  heartbeat(_token: string, body: HeartbeatBody) {
    this.heartbeats.push(body)
    return Promise.resolve({ rulesVersion: this.revision, tokenRotationDue: false })
  }

  getRuleSet(_token: string, ifNoneMatch: number | null): Promise<RuleSetRead> {
    if (ifNoneMatch === this.revision) return Promise.resolve({ kind: 'not_modified' })
    return Promise.resolve({ kind: 'fetched', revision: this.revision, ruleSet: this.ruleSet })
  }

  putRuleSet(_token: string, ruleSet: unknown, ifMatch: number): Promise<RuleSetWriteResult> {
    this.puts.push({ ruleSet, ifMatch })
    if (ifMatch !== this.revision)
      return Promise.resolve({ kind: 'conflict', revision: this.revision })
    this.revision += 1
    this.ruleSet = ruleSet
    return Promise.resolve({ kind: 'saved', revision: this.revision })
  }
}

function withBudget(ruleset: Ruleset, minutes: number): Ruleset {
  return { ...ruleset, rules: [makeRule({ dailyBudgetMinutes: minutes })] }
}

async function setup(local: Ruleset, server: FakeServer, syncedRevision = 0) {
  await fakeBrowser.storage.local.set({ [RULESET_KEY]: local })
  const clock = new ManualClock('2026-10-27T10:00:00Z')
  const rules = new RuleChangeService({
    rulesets: new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone: () => 'UTC' }),
    pending: new PendingRuleChangeStore(fakeBrowser.storage.local),
    catalog: bundledRulesCatalog(),
    clock,
  })
  const connections = new ServerConnectionStore(fakeBrowser.storage.local)
  await connections.save({
    origin: 'https://focus.example.org',
    token: TOKEN,
    deviceUuid: '00000000-0000-4000-8000-000000000001',
    pinnedKids: { unlock: ['u'.repeat(16)], policy: ['p'.repeat(16)] },
    ledger: {
      ...EMPTY_SYNC_LEDGER,
      revision: syncedRevision,
      syncedHash: syncedRevision > 0 ? await ruleSetFingerprint(local) : null,
    },
  })
  const sync = new RuleSetSync({
    connections,
    client: () => server,
    rules,
    validate: validateRuleset,
    clock,
    boot: 'boot-1',
    nonce: () => 'n'.repeat(22),
  })
  return { sync, rules, connections }
}

describe('RuleSetSync', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('incoming_loosening_waits_until_tomorrow', async () => {
    const local = withBudget(makeRuleset(), 30)
    const server = new FakeServer(4, withBudget(makeRuleset(), 90))
    const { sync, rules, connections } = await setup(local, server, 3)

    await sync.run()

    const state = await rules.state()
    expect(state.effective.rules[0]?.dailyBudgetMinutes).toBe(30)
    expect(state.pending?.ruleset.rules[0]?.dailyBudgetMinutes).toBe(90)
    expect((await connections.load())?.ledger.revision).toBe(4)
    expect(server.puts).toEqual([])
  })

  it('incoming_tightening_applies_now', async () => {
    const server = new FakeServer(4, withBudget(makeRuleset(), 10))
    const { sync, rules } = await setup(withBudget(makeRuleset(), 30), server, 3)

    await sync.run()

    expect((await rules.state()).effective.rules[0]?.dailyBudgetMinutes).toBe(10)
    expect(server.puts).toEqual([])
  })

  it('first_connection_seeds_an_empty_server_with_the_local_set', async () => {
    const server = new FakeServer(0, null)
    const { sync, connections } = await setup(makeRuleset(), server)

    await sync.run()

    expect(server.puts).toHaveLength(1)
    expect(server.puts[0]?.ifMatch).toBe(0)
    expect((await connections.load())?.ledger.revision).toBe(1)
  })

  it('heartbeat_reports_the_applied_revision', async () => {
    const server = new FakeServer(3, makeRuleset())
    const { sync } = await setup(makeRuleset(), server, 3)

    await sync.run()

    expect(server.heartbeats[0]?.ruleSetRevision).toBe(3)
    expect(server.puts).toEqual([])
  })

  it('without_a_connection_nothing_is_sent', async () => {
    const server = new FakeServer(3, makeRuleset())
    const { sync, connections } = await setup(makeRuleset(), server, 3)
    await fakeBrowser.storage.local.remove('sync.server')
    expect(await connections.load()).toBeNull()

    await sync.run()

    expect(server.heartbeats).toEqual([])
  })
})
