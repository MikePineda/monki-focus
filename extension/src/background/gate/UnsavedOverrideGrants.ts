// SPDX-License-Identifier: AGPL-3.0-or-later

/** `storage.session` key of the overrides granted while their state could not be stored. */
export const UNSAVED_OVERRIDE_GRANTS_NAME = 'gate.unsavedOverrides'
/** The most recent waits remembered. */
const MAX_GRANTS = 50

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

type GrantTable = Record<string, number>

function isGrantTable(value: unknown): value is GrantTable {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((endsAt) => typeof endsAt === 'number')
  )
}

/**
 * When the wait of an emergency override is over but its 15 minutes cannot
 * be stored, the tab still gets through on a pass. The escalation state then
 * stays in `override_waiting`, so without a record every new "done" would
 * grant again and record another bypass. This keeps, per wait (the group and
 * its `overrideReadyAt`), when its one grant ends: passes for that wait only
 * until then, never a second grant. Kept in memory and, best-effort, in
 * `storage.session` (a separate area from the `storage.local` that failed),
 * so a restarted worker still knows.
 */
export class UnsavedOverrideGrants {
  private readonly memory = new Map<string, number>()

  constructor(private readonly storage: StorageArea) {}

  /** When the wait's grant ends (epoch ms), or null when it has none. */
  async endsAt(wait: string): Promise<number | null> {
    const remembered = this.memory.get(wait)
    if (remembered !== undefined) return remembered
    const table = await this.table()
    return Object.hasOwn(table, wait) ? (table[wait] as number) : null
  }

  async record(wait: string, endsAtMs: number): Promise<void> {
    this.memory.set(wait, endsAtMs)
    await this.write((table) => ({ ...table, [wait]: endsAtMs }))
  }

  /** The clock went back: every remembered grant is over (it would last longer than chosen). */
  async expireAll(): Promise<void> {
    for (const wait of this.memory.keys()) this.memory.set(wait, 0)
    await this.write((table) =>
      Object.fromEntries(Object.keys(table).map((wait) => [wait, 0] as const))
    )
  }

  private async write(change: (table: GrantTable) => GrantTable): Promise<void> {
    try {
      const entries = Object.entries(change(await this.table())).slice(-MAX_GRANTS)
      await this.storage.set({ [UNSAVED_OVERRIDE_GRANTS_NAME]: Object.fromEntries(entries) })
    } catch {
      // The memory copy still caps the grants of this worker.
    }
  }

  private async table(): Promise<GrantTable> {
    try {
      const stored = (await this.storage.get(UNSAVED_OVERRIDE_GRANTS_NAME))[
        UNSAVED_OVERRIDE_GRANTS_NAME
      ]
      return isGrantTable(stored) ? stored : {}
    } catch {
      return {}
    }
  }
}
