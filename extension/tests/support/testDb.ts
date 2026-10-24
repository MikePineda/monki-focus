// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { openMonkiDb, type MonkiDb } from '../../src/background/storage/db'

/** A fresh, empty database per test (`RefreshDatabase`), on `fake-indexeddb`. */
export function freshDb(): Promise<MonkiDb> {
  return openMonkiDb(`monki-test-${crypto.randomUUID()}`)
}
