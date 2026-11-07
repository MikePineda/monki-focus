// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What this device knows about its last exchange with the server's rule set
 * (docs/CONTRACTS.md "Rule set sync (S15)"). Hashes are fingerprints of the
 * configured set without its editor fields (`RuleSetFingerprint`), so a set
 * that went through the local `RuleChangePolicy` still equals what came in.
 */
export interface SyncLedger {
  /** The server revision this device applied or wrote last (0: none). */
  revision: number
  /** Fingerprint of the set at `revision`. */
  syncedHash: string | null
  /** Fingerprint of the last local set the server refused (422). */
  rejectedHash: string | null
  /** How many local sets the server refused (shown, never retried). */
  rejectedCount: number
}

export const EMPTY_SYNC_LEDGER: SyncLedger = {
  revision: 0,
  syncedHash: null,
  rejectedHash: null,
  rejectedCount: 0,
}

/** What the last exchange with the server answered. */
export type SyncObservation =
  | { kind: 'heartbeat'; rulesVersion: number }
  | { kind: 'fetched'; revision: number; ruleSet: unknown; hash: string | null }
  | { kind: 'not_modified' }
  | { kind: 'applied'; revision: number; hash: string }
  | { kind: 'pushed'; revision: number; hash: string }
  /** 412: the server holds `revision`, newer than the one we edited. */
  | { kind: 'conflict'; revision: number }
  /** 422: the server refused the set with this fingerprint. */
  | { kind: 'refused'; hash: string }

/** The next thing the adapter does. */
export type SyncStep =
  | { kind: 'none' }
  | { kind: 'fetch'; ifNoneMatch: number | null }
  | { kind: 'push'; ifMatch: number; hash: string }
  /** Propose `ruleSet` through `RuleChangePolicy`, then report `applied`. */
  | { kind: 'apply'; revision: number; ruleSet: unknown; hash: string }

export interface SyncPlan {
  step: SyncStep
  ledger: SyncLedger
}

/**
 * Decides the next sync step from the local set's fingerprint, the ledger
 * and what the server just answered. Pure: no I/O, no clock.
 *
 * - The server is the source of truth when it is newer: an incoming set is
 *   never written directly, it is proposed through the device's own
 *   `RuleChangePolicy` (tightening now, loosening from the next local day),
 *   so a remote loosening can never take effect sooner than a local one.
 * - A local edit is pushed with `If-Match` of the revision it was based on;
 *   a 412 re-fetches (the server wins, its set goes through the policy).
 * - A 422 is dropped and counted; the same set is never pushed again, only
 *   a new edit is.
 */
export function planRuleSetSync(
  localHash: string,
  ledger: SyncLedger,
  observation: SyncObservation
): SyncPlan {
  switch (observation.kind) {
    case 'heartbeat':
      if (observation.rulesVersion !== ledger.revision) {
        return { step: { kind: 'fetch', ifNoneMatch: ledger.revision }, ledger }
      }
      return { step: pushIfEdited(localHash, ledger), ledger }
    case 'not_modified':
      return { step: pushIfEdited(localHash, ledger), ledger }
    case 'fetched': {
      if (observation.ruleSet === null || observation.hash === null) {
        const next = { ...ledger, revision: observation.revision, syncedHash: null }
        return { step: pushIfEdited(localHash, next), ledger: next }
      }
      if (observation.hash === localHash) {
        return {
          step: { kind: 'none' },
          ledger: { ...ledger, revision: observation.revision, syncedHash: localHash },
        }
      }
      return {
        step: {
          kind: 'apply',
          revision: observation.revision,
          ruleSet: observation.ruleSet,
          hash: observation.hash,
        },
        ledger,
      }
    }
    case 'applied':
    case 'pushed':
      return {
        step: { kind: 'none' },
        ledger: { ...ledger, revision: observation.revision, syncedHash: observation.hash },
      }
    case 'conflict':
      return { step: { kind: 'fetch', ifNoneMatch: null }, ledger }
    case 'refused':
      return {
        step: { kind: 'none' },
        ledger: {
          ...ledger,
          rejectedHash: observation.hash,
          rejectedCount: ledger.rejectedCount + 1,
        },
      }
  }
}

function pushIfEdited(localHash: string, ledger: SyncLedger): SyncStep {
  if (localHash === ledger.syncedHash || localHash === ledger.rejectedHash) return { kind: 'none' }
  return { kind: 'push', ifMatch: ledger.revision, hash: localHash }
}
