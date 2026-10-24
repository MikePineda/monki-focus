// SPDX-License-Identifier: AGPL-3.0-or-later

/** The slice of `tabs` closing a gate needs. */
export interface ClosingTabsApi {
  get(tabId: number): Promise<{ windowId?: number | undefined }>
  query(query: { windowId: number }): Promise<{ id?: number | undefined }[]>
  create(properties: { windowId: number; active: boolean }): Promise<unknown>
  remove(tabId: number): Promise<void>
}

/**
 * Close and Leave: the tab goes away. When it is the last tab of its
 * window a new tab opens first, so closing the gate never closes the window
 * (and with it the browser).
 */
export class TabCloser {
  constructor(private readonly tabs: ClosingTabsApi) {}

  async close(tabId: number): Promise<boolean> {
    const { windowId } = await this.tabs.get(tabId)
    if (typeof windowId === 'number') {
      const siblings = await this.tabs.query({ windowId })
      if (siblings.filter((tab) => tab.id !== tabId).length === 0) {
        await this.tabs.create({ windowId, active: true })
      }
    }
    await this.tabs.remove(tabId)
    return true
  }
}
