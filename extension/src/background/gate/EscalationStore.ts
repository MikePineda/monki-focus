// SPDX-License-Identifier: AGPL-3.0-or-later
import { initialEscalationState } from '@monki-focus/engine'
import type { EscalationState } from '@monki-focus/rules/pure'

/** `storage.local` key of every group's escalation state. */
export const ESCALATION_NAME = 'gate.escalation'

/** The engine's cap on states per decision (`DecisionState.escalation`). */
const MAX_STATES = 500

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface EscalationStoreOptions {
  /** Whether one stored entry may reach the engine (`escalationEntryGuard`). */
  isValid?: (entry: unknown) => boolean | Promise<boolean>
  /** Called once per dropped entry. */
  onInvalid?: () => void
}

/**
 * One escalation state per target group (SEMANTICS.md §7), as the engine
 * returned it, in `storage.local`: the whole state survives a service
 * worker that sleeps and a browser restart, so reloading or restarting never
 * resets a pause, a wait, an intention or the counters (`lastFrictionType`
 * included). Writes run one at a time.
 *
 * Every entry is checked on read and only invalid entries are dropped, so
 * one corrupt group never resets the others' levels nor makes `decide` fail
 * closed for every page.
 */
export class EscalationStore {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly storage: StorageArea,
    private readonly options: EscalationStoreOptions = {}
  ) {}

  async all(): Promise<EscalationState[]> {
    const stored = (await this.storage.get(ESCALATION_NAME))[ESCALATION_NAME]
    if (!Array.isArray(stored)) return []
    const valid: EscalationState[] = []
    const seen = new Set<string>()
    for (const entry of stored as unknown[]) {
      if (await this.isValid(entry)) {
        const state = entry as EscalationState
        if (seen.has(state.targetGroup)) continue
        seen.add(state.targetGroup)
        valid.push(state)
      } else {
        this.options.onInvalid?.()
      }
    }
    return valid
  }

  /** The group's state, or the engine's initial idle state. */
  async get(group: string): Promise<EscalationState> {
    return (
      (await this.all()).find((state) => state.targetGroup === group) ??
      initialEscalationState(group)
    )
  }

  /** Stores `state` in place of its group's; the least recently active states fall off the cap. */
  put(state: EscalationState): Promise<void> {
    return this.exclusive(async () => {
      const others = (await this.all()).filter((other) => other.targetGroup !== state.targetGroup)
      const next = [state, ...others]
      if (next.length > MAX_STATES) {
        next.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
        next.length = MAX_STATES
      }
      await this.storage.set({ [ESCALATION_NAME]: next })
    })
  }

  private async isValid(entry: unknown): Promise<boolean> {
    if (typeof entry !== 'object' || entry === null) return false
    if (typeof (entry as { targetGroup?: unknown }).targetGroup !== 'string') return false
    try {
      return this.options.isValid ? await this.options.isValid(entry) : true
    } catch {
      return false
    }
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }
}
