// SPDX-License-Identifier: AGPL-3.0-or-later

/** `storage.session` key of the gate's per-tab state. */
export const GATE_TABS_NAME = 'gate.tabs'

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

/** What the service worker remembers about one tab the gate stands in. */
export interface GateTab {
  /** Where the tab was going when the gate took over (never read from the gate's URL). */
  destination: string | null
  /** A URL the gate let through on purpose (its search box): never gated again in this tab. */
  searchPass: string | null
}

type TabTable = Record<string, GateTab>

function isTabTable(value: unknown): value is TabTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The per-tab state in `storage.session`: it survives the service worker
 * sleeping (a reloaded gate finds its destination again) and is cleared with
 * the browser session. The gate page never says where it goes: it asks for
 * the destination of its own tab (`sender.tab.id`), so a `?to=` it was
 * opened with is ignored.
 */
export class GateTabs {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(private readonly storage: StorageArea) {}

  async get(tabId: number): Promise<GateTab> {
    const table = await this.table()
    return Object.hasOwn(table, String(tabId))
      ? (table[String(tabId)] as GateTab)
      : { destination: null, searchPass: null }
  }

  setDestination(tabId: number, destination: string): Promise<void> {
    return this.update(tabId, (tab) => ({ ...tab, destination }))
  }

  setSearchPass(tabId: number, url: string): Promise<void> {
    return this.update(tabId, (tab) => ({ ...tab, searchPass: url }))
  }

  /** The tab closed: forget it. */
  forget(tabId: number): Promise<void> {
    return this.exclusive(async () => {
      const table = await this.table()
      if (!Object.hasOwn(table, String(tabId))) return
      const rest = new Map(Object.entries(table))
      rest.delete(String(tabId))
      await this.storage.set({ [GATE_TABS_NAME]: Object.fromEntries(rest) })
    })
  }

  private update(tabId: number, change: (tab: GateTab) => GateTab): Promise<void> {
    return this.exclusive(async () => {
      const table = await this.table()
      const current = Object.hasOwn(table, String(tabId))
        ? (table[String(tabId)] as GateTab)
        : { destination: null, searchPass: null }
      await this.storage.set({ [GATE_TABS_NAME]: { ...table, [String(tabId)]: change(current) } })
    })
  }

  private async table(): Promise<TabTable> {
    const stored = (await this.storage.get(GATE_TABS_NAME))[GATE_TABS_NAME]
    return isTabTable(stored) ? stored : {}
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }
}
