// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { starterPreset } from '@monki-focus/rules/pure'
import type { Browser } from 'wxt/browser'

/** `browser.storage.local` key of the user's rule set. */
export const RULESET_KEY = 'rules.ruleset'

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set'>
type ChangeListener = (
  changes: Record<string, Browser.storage.StorageChange>,
  areaName: string
) => void
/** The slice of `browser.storage.onChanged` the store follows. */
export interface StorageChangedEvent {
  addListener(listener: ChangeListener): void
}

export interface RulesetStoreOptions {
  storage: StorageArea
  /** The device's IANA zone, read only when a rule set is first created. */
  deviceTimeZone: () => string
}

/**
 * The user's rule set in `storage.local`. The first read (or the install
 * hook) creates it from the starter preset (`@monki-focus/rules/pure`) with
 * `timeZone` set to the device zone; from then on the zone is pinned and only
 * a rule change (E8, SEMANTICS.md §8) can move it. Editing arrives with E8;
 * until then the stored copy is only read. The parsed value is cached until
 * storage reports a change.
 *
 * Every read-create and every write runs through one in-memory promise
 * chain, so creating the starter can never overwrite a rule set saved
 * concurrently. **Every writer of `rules.ruleset` must go through this store
 * (`save`)**; writing the key directly bypasses the lock.
 */
export class RulesetStore {
  private cached: Promise<Ruleset> | undefined
  private lock: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: RulesetStoreOptions) {}

  /** The stored rule set, creating the starter one when there is none. */
  load(): Promise<Ruleset> {
    this.cached ??= this.exclusive(() => this.readOrCreate()).catch((error: unknown) => {
      this.cached = undefined
      throw error
    })
    return this.cached
  }

  /** Stores `ruleset` (after any pending read or write) and caches it. */
  save(ruleset: Ruleset): Promise<void> {
    return this.exclusive(async () => {
      await this.options.storage.set({ [RULESET_KEY]: ruleset })
      this.cached = Promise.resolve(ruleset)
    })
  }

  /** Install hook: creates the starter rule set now (no-op when one exists). */
  async ensureCreated(): Promise<void> {
    await this.load()
  }

  /** Drops the cache whenever the stored rule set changes; calls `onChange` after. */
  watch(onChanged: StorageChangedEvent, onChange?: () => void): void {
    onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !Object.hasOwn(changes, RULESET_KEY)) return
      this.cached = undefined
      onChange?.()
    })
  }

  /** Runs `task` after every task queued before it; a failure never blocks the queue. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }

  private async readOrCreate(): Promise<Ruleset> {
    const stored = await this.options.storage.get(RULESET_KEY)
    const existing: unknown = stored[RULESET_KEY]
    // Anything stored is handed to the engine as is: an invalid rule set
    // fails closed there (engine_error), never silently replaced by a laxer one.
    if (existing !== undefined) return existing as Ruleset
    const created: Ruleset = {
      ...structuredClone(starterPreset),
      timeZone: this.options.deviceTimeZone(),
    }
    await this.options.storage.set({ [RULESET_KEY]: created })
    return created
  }
}
