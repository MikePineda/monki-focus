// SPDX-License-Identifier: AGPL-3.0-or-later

/** `browser.storage.session` key: who aggregates this device's activity right now. */
export const AGGREGATOR_STORAGE_NAME = 'bridge.aggregator'

interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

/**
 * The dedupe switch of plan §3.4: while the Mac app has acknowledged this
 * extension (`hello.ack {aggregator: "mac"}`) it aggregates and syncs the
 * device's activity, so the extension stops queueing its own blocks for
 * sync and keeps only its local stats. Cleared when the bridge disconnects
 * or the app is unavailable, so a missing app never silences the extension.
 * Kept in session storage: it survives a service worker restart until the
 * next connection says otherwise, and never outlives the browser session.
 */
export class AggregatorFlag {
  constructor(private readonly session: SessionArea) {}

  async set(aggregator: 'mac' | null): Promise<void> {
    if (aggregator === null) await this.session.remove(AGGREGATOR_STORAGE_NAME)
    else await this.session.set({ [AGGREGATOR_STORAGE_NAME]: aggregator })
  }

  async isMac(): Promise<boolean> {
    return (await this.session.get(AGGREGATOR_STORAGE_NAME))[AGGREGATOR_STORAGE_NAME] === 'mac'
  }

  /** Whether the extension should queue its own blocks for sync. */
  async extensionSyncsBlocks(): Promise<boolean> {
    return !(await this.isMac())
  }
}
