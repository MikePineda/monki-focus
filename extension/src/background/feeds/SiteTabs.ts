// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ScriptPublicPath } from 'wxt/utils/inject-script'
import { SITE_HOST_PERMISSIONS } from '../../../config/extensionManifest'

/** The slice of `tabs` and `scripting` the site-tab helpers use. */
export interface SiteTabsApi {
  query(query: { url: string[] }): Promise<{ id?: number | undefined }[]>
  sendMessage(tabId: number, message: unknown): Promise<unknown>
  executeScript(injection: {
    target: { tabId: number }
    files: ScriptPublicPath[]
  }): Promise<unknown>
}

/** The built content script, as WXT emits it. */
export const FEED_GUARD_SCRIPT: ScriptPublicPath = '/content-scripts/feed-guard.js'

/**
 * The open tabs of the built-in sites (the content script's matches). Every
 * call swallows per-tab failures: a tab without a listening feed guard, a
 * discarded tab or a closed one must not stop the others.
 */
export class SiteTabs {
  constructor(private readonly api: SiteTabsApi) {}

  /** Sends `message` to the feed guard of every open site tab. */
  async broadcast(message: unknown): Promise<number> {
    const ids = await this.tabIds()
    const results = await Promise.allSettled(ids.map((id) => this.api.sendMessage(id, message)))
    return results.filter((result) => result.status === 'fulfilled').length
  }

  /**
   * Injects the feed guard into the site tabs that were open before this
   * version was installed (an update orphans the old content scripts; a
   * fresh install never ran in them).
   */
  async injectFeedGuard(): Promise<number> {
    const ids = await this.tabIds()
    const results = await Promise.allSettled(
      ids.map((tabId) => this.api.executeScript({ target: { tabId }, files: [FEED_GUARD_SCRIPT] }))
    )
    return results.filter((result) => result.status === 'fulfilled').length
  }

  private async tabIds(): Promise<number[]> {
    const tabs = await this.api.query({ url: [...SITE_HOST_PERMISSIONS] })
    return tabs.flatMap((tab) => (typeof tab.id === 'number' ? [tab.id] : []))
  }
}
