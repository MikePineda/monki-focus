// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'
import type { PendingRuleChange } from '../../shared/RuleChangeContract'

/** `browser.storage.local` key of the rule change waiting for its `effectiveFrom`. */
export const PENDING_RULESET_KEY = 'rules.pending'

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set' | 'remove'>

function isPendingRuleChange(value: unknown): value is PendingRuleChange {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PendingRuleChange>
  return (
    typeof candidate.effectiveFrom === 'string' &&
    typeof candidate.ruleset === 'object' &&
    candidate.ruleset !== null
  )
}

/**
 * The pending (loosening) rule change. Only `RuleChangeService` writes it,
 * inside its own queue. Anything unreadable counts as no pending change:
 * dropping a pending change never loosens anything.
 */
export class PendingRuleChangeStore {
  constructor(private readonly storage: StorageArea) {}

  async load(): Promise<PendingRuleChange | null> {
    const stored: unknown = (await this.storage.get(PENDING_RULESET_KEY))[PENDING_RULESET_KEY]
    return isPendingRuleChange(stored) ? stored : null
  }

  save(pending: PendingRuleChange): Promise<void> {
    return this.storage.set({ [PENDING_RULESET_KEY]: pending })
  }

  clear(): Promise<void> {
    return this.storage.remove(PENDING_RULESET_KEY)
  }
}
