// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MonkiDb } from './db'

/**
 * The worker's one IndexedDB connection, opened on first use. A failed
 * open is never cached: the next caller tries again, so a database that
 * was briefly unavailable (disk pressure, a blocked upgrade) does not stay
 * unusable for the worker's lifetime.
 */
export class DbConnection {
  private opening: Promise<MonkiDb> | null = null

  constructor(private readonly open: () => Promise<MonkiDb>) {}

  get(): Promise<MonkiDb> {
    this.opening ??= this.open().catch((error: unknown) => {
      this.opening = null
      throw error
    })
    return this.opening
  }
}
