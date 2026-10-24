// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'
import type { FeedDecisions } from '../commands/commands'

/** `storage.local` key an E2E spec sets to slow every feed decision down. */
export const E2E_DECISION_DELAY_STORAGE_NAME = 'e2e.decisionDelayMs'
const MAX_DELAY_MS = 30_000

/**
 * E2E build only (wired behind `import.meta.env.MODE === 'e2e'`, so the
 * production bundle drops it): delays each feed decision by the number of
 * milliseconds stored under `e2e.decisionDelayMs`, to prove the feed guard
 * keeps feeds hidden while the service worker is slow.
 */
export function delayedFeedDecisions(
  inner: FeedDecisions,
  storage: Pick<Browser.storage.StorageArea, 'get'>
): FeedDecisions {
  return {
    async feedDecisionFor(url) {
      const stored = await storage.get(E2E_DECISION_DELAY_STORAGE_NAME)
      const delay = Number(stored[E2E_DECISION_DELAY_STORAGE_NAME])
      if (Number.isFinite(delay) && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, MAX_DELAY_MS)))
      }
      return inner.feedDecisionFor(url)
    },
  }
}
