// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset, ValidationResult } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import { configuredRuleset } from '../../shared/RuleChangeContract'
import type { RuleChangeService } from '../rules/RuleChangeService'
import { ruleSetFingerprint, sha256Base64Url } from './RuleSetFingerprint'
import { planRuleSetSync, type SyncObservation, type SyncLedger } from './RuleSetSyncPlan'
import type { ServerClient } from './ServerClient'
import type { ServerConnectionStore } from './ServerConnectionStore'

/** Alarm of the periodic sync (the contract's 15-minute heartbeat). */
export const SERVER_SYNC_ALARM = 'sync.server'
export const SERVER_SYNC_MINUTES = 15

/** At most this many requests per run, so a confused server can never loop us. */
const MAX_STEPS = 4

export interface RuleSetSyncOptions {
  connections: Pick<ServerConnectionStore, 'load' | 'saveLedger'>
  client: (origin: string) => Pick<ServerClient, 'heartbeat' | 'getRuleSet' | 'putRuleSet'>
  /** The same path the Options editor uses: every incoming set goes through the policy. */
  rules: Pick<RuleChangeService, 'state' | 'propose'>
  validate: (value: unknown) => ValidationResult
  clock: Clock
  /** The service worker's per-instance boot id. */
  boot: string
  /** 16 fresh random bytes, unpadded base64url. */
  nonce: () => string
}

function revisionOf(ruleset: Ruleset): number {
  return Number.isInteger(ruleset.revision) ? ruleset.revision : 0
}

/**
 * One sync run: heartbeat, then the steps `planRuleSetSync` decides (pull,
 * apply through `RuleChangeService`, push with `If-Match`). Only runs when
 * the user connected a server. Errors propagate as `ServerError` reason
 * codes; nothing is logged.
 */
export class RuleSetSync {
  private running: Promise<void> | null = null

  constructor(private readonly options: RuleSetSyncOptions) {}

  run(): Promise<void> {
    this.running ??= this.once().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async once(): Promise<void> {
    const connection = await this.options.connections.load()
    if (connection === null) return
    const client = this.options.client(connection.origin)
    let ledger: SyncLedger = connection.ledger
    let configured = configuredRuleset(await this.options.rules.state())
    let localHash = await ruleSetFingerprint(configured)

    const answer = await client.heartbeat(connection.token, {
      clientTime: new Date(this.options.clock.now()).toISOString(),
      protectionActive: true,
      rulesHash: localHash,
      policyHash: await sha256Base64Url(''),
      nonce: this.options.nonce(),
      boot: this.options.boot,
      pinnedKids: connection.pinnedKids,
      ruleSetRevision: ledger.revision,
    })
    let observation: SyncObservation = { kind: 'heartbeat', rulesVersion: answer.rulesVersion }

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const plan = planRuleSetSync(localHash, ledger, observation)
      ledger = plan.ledger
      const next = plan.step
      if (next.kind === 'none') break
      if (next.kind === 'fetch') {
        const read = await client.getRuleSet(connection.token, next.ifNoneMatch)
        observation =
          read.kind === 'not_modified'
            ? read
            : {
                kind: 'fetched',
                revision: read.revision,
                ruleSet: read.ruleSet,
                hash: read.ruleSet === null ? null : await ruleSetFingerprint(read.ruleSet),
              }
      } else if (next.kind === 'push') {
        const written = await client.putRuleSet(connection.token, configured, next.ifMatch)
        observation =
          written.kind === 'saved'
            ? { kind: 'pushed', revision: written.revision, hash: next.hash }
            : written.kind === 'conflict'
              ? { kind: 'conflict', revision: written.revision }
              : { kind: 'refused', hash: next.hash }
      } else {
        // An incoming set that does not validate here is never applied; it
        // is fetched again next run (the ledger stays as it was).
        if (!this.options.validate(next.ruleSet).valid) break
        const outcome = await this.options.rules.propose({
          ruleset: next.ruleSet as Ruleset,
          baseRevision: revisionOf(configured),
        })
        if (outcome.status === 'rejected') break
        configured = configuredRuleset(outcome.state)
        localHash = await ruleSetFingerprint(configured)
        observation = { kind: 'applied', revision: next.revision, hash: next.hash }
      }
    }
    await this.options.connections.saveLedger(ledger)
  }
}
