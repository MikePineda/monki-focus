// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import type { WebTabData } from '@monki-focus/rules'
import type { BrowserActivityPayload } from './BridgeContract'

function isWebTab(data: ActivityEvent['data']): data is WebTabData {
  return 'domain' in data
}

function sameTab(a: WebTabData, b: WebTabData): boolean {
  return (
    a.domain === b.domain &&
    a.path === b.path &&
    a.surface === b.surface &&
    a.audible === b.audible &&
    a.incognito === b.incognito &&
    a.title === b.title
  )
}

/**
 * Mirrors the extension's heartbeats to the Mac app as `browser.activity`,
 * so the app's web bucket merges exactly what `HeartbeatRecorder` stores:
 * each probed heartbeat as is, and, when a pulse knows the instant the
 * previous tab stopped (`closeAt`) and the new heartbeat does not continue
 * it, a zero-length heartbeat of the previous tab at that instant first.
 * The heartbeats already hold only what the local store keeps (no query,
 * no fragment, a title only when the user turned titles on, never in
 * incognito); nothing is added. Unsent heartbeats (no app) are not queued.
 */
export class BridgeActivityForwarder {
  private last: WebTabData | null = null

  constructor(private readonly send: (payload: BrowserActivityPayload) => boolean) {}

  record(next: ActivityEvent | null, closeAt: string | null): void {
    const nextTab = next !== null && isWebTab(next.data) ? next.data : null
    if (
      closeAt !== null &&
      this.last !== null &&
      (nextTab === null || !sameTab(nextTab, this.last))
    ) {
      this.send({ timestamp: closeAt, duration: 0, data: this.last })
    }
    if (next !== null && nextTab !== null) {
      this.send({ timestamp: next.timestamp, duration: next.duration, data: nextTab })
    }
    this.last = nextTab
  }
}
