// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'

/** The alarm that re-checks restrictions so schedule edges reach open tabs. */
export const RESTRICTION_ALARM = 'decision.refresh'
/** Chrome's minimum alarm period; schedules are minute-grained. */
export const RESTRICTION_CHECK_MINUTES = 1
/** `storage.session` key of the last restricted set (survives worker restarts). */
export const RESTRICTION_SNAPSHOT_NAME = 'decision.restrictedSurfaces'

/** The slice of `DecisionService` the watcher asks. */
export interface SurfaceRestriction {
  restricts(surface: string): Promise<boolean>
}

/** The slice of a storage area the watcher keeps its snapshot in. */
export interface SnapshotStorage {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface RestrictionWatcherOptions {
  catalog: RulesCatalog
  restriction: SurfaceRestriction
  storage: SnapshotStorage
  /** Runs when the restricted set changed since the last check. */
  onChange: () => Promise<void> | void
}

/**
 * The engine answers a decision for an instant and does not say until when
 * it holds, so the worker re-checks every minute (an alarm) which feed
 * surfaces the rule set restricts right now. When a schedule edge changes
 * that set, `onChange` tells the open site tabs to ask again. The snapshot
 * lives in `storage.session`, so a worker that slept in between still sees
 * the change.
 */
export class RestrictionWatcher {
  constructor(private readonly options: RestrictionWatcherOptions) {}

  /** Returns whether the restricted set changed (and `onChange` ran). */
  async check(): Promise<boolean> {
    const { catalog, restriction, storage, onChange } = this.options
    const feeds = catalog.profiles
      .flatMap((profile) => profile.surfaces.map(({ surface }) => surface))
      .filter((surface) => catalog.surfaceKind(surface) === 'feed')
    const restricted: string[] = []
    for (const surface of feeds) {
      if (await restriction.restricts(surface)) restricted.push(surface)
    }
    const snapshot = restricted.sort().join(' ')

    const previous = (await storage.get(RESTRICTION_SNAPSHOT_NAME))[RESTRICTION_SNAPSHOT_NAME]
    if (previous === snapshot) return false
    await storage.set({ [RESTRICTION_SNAPSHOT_NAME]: snapshot })
    if (typeof previous !== 'string') return false
    await onChange()
    return true
  }
}
