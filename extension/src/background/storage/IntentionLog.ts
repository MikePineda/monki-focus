// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentionEntry, MonkiDb } from './db'

/**
 * What the intention gate did, one row per fact (a visit to the gate, a
 * commitment, an intention kept or broken, a close), for the day's numbers
 * (`stats.today.intentions`, the gate's context line). A row carries the
 * escalation group and the instant only: never a URL, a title or the
 * intention's text.
 */
export class IntentionLog {
  constructor(private readonly db: MonkiDb) {}

  async record(entry: Omit<IntentionEntry, 'id'>): Promise<void> {
    await this.db.add('intentions', { at: entry.at, kind: entry.kind, group: entry.group })
  }

  /** Entries with `at` in `[from, to)`, oldest first. */
  between(from: string, to: string): Promise<IntentionEntry[]> {
    return this.db.getAllFromIndex('intentions', 'at', IDBKeyRange.bound(from, to, false, true))
  }

  /** Deletes the entries before `before`; answers how many. */
  async deleteBefore(before: string): Promise<number> {
    const tx = this.db.transaction('intentions', 'readwrite')
    let deleted = 0
    let cursor = await tx.store.index('at').openCursor(IDBKeyRange.upperBound(before, true))
    while (cursor) {
      await cursor.delete()
      deleted += 1
      cursor = await cursor.continue()
    }
    await tx.done
    return deleted
  }
}
