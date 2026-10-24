// SPDX-License-Identifier: AGPL-3.0-or-later
import { starterPreset, type Ruleset } from '@monki-focus/rules/pure'
import { expect, type BrowserContext, type Worker } from '@playwright/test'

/** The slice of the service worker's `chrome` global the specs use. */
interface WorkerGlobal {
  chrome: {
    storage: {
      local: {
        get(): Promise<Record<string, unknown>>
        set(items: Record<string, unknown>): Promise<void>
      }
    }
    declarativeNetRequest: { getSessionRules(): Promise<{ id: number }[]> }
  }
}

/** The gate's per-group redirect rules (`GateRedirectRules`). */
const REDIRECT_RULE_IDS = { first: 10_000, end: 14_000 }

/**
 * Which rule set a spec starts from: `gateless` (the starter without its
 * friction rules and without bedtime: feeds only, nothing redirects to the
 * gate), `gated` (the starter without bedtime: Reddit and X go through the
 * gate) or `untouched` (whatever the extension created at install).
 */
export type StartingRuleset = 'gateless' | 'gated' | 'untouched'

/** The starter rule set without bedtime, optionally without its friction rules. */
export function starterRuleset({ friction }: { friction: boolean }): Ruleset {
  return {
    ...structuredClone(starterPreset),
    rules: starterPreset.rules.filter((rule) => friction || rule.mode !== 'friction'),
    bedtime: { ...starterPreset.bedtime, enabled: false },
  }
}

export function extensionWorker(context: BrowserContext): Worker {
  const [worker] = context.serviceWorkers()
  if (!worker) throw new Error('extension service worker is not running')
  return worker
}

/** How many gate redirects the service worker has installed. */
export function gateRedirectCount(context: BrowserContext): Promise<number> {
  return extensionWorker(context).evaluate(async ({ first, end }) => {
    const { chrome } = globalThis as unknown as WorkerGlobal
    const rules = await chrome.declarativeNetRequest.getSessionRules()
    return rules.filter((rule) => rule.id >= first && rule.id < end).length
  }, REDIRECT_RULE_IDS)
}

/** Writes `storage.local` from the service worker, after it created the starter rule set. */
export async function setExtensionStorage(context: BrowserContext, items: Record<string, unknown>) {
  const worker = extensionWorker(context)
  // The worker creates the starter rule set first; it must not overwrite this one.
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const { chrome } = globalThis as unknown as WorkerGlobal
        return 'rules.ruleset' in (await chrome.storage.local.get())
      })
    )
    .toBe(true)
  await worker.evaluate((values) => {
    const { chrome } = globalThis as unknown as WorkerGlobal
    return chrome.storage.local.set(values)
  }, items)
}

/** Stores `ruleset` and waits until the gate's redirects follow it. */
export async function useRuleset(
  context: BrowserContext,
  ruleset: Ruleset,
  expectedRedirects: number
): Promise<void> {
  await setExtensionStorage(context, { 'rules.ruleset': ruleset })
  await expect.poll(() => gateRedirectCount(context)).toBe(expectedRedirects)
}

/** Moves the clock of the e2e build (`e2e.clockOffsetMs`) forward by `seconds`. */
export async function advanceClock(context: BrowserContext, seconds: number): Promise<void> {
  await extensionWorker(context).evaluate(async (delta) => {
    const { chrome } = globalThis as unknown as WorkerGlobal
    const stored = (await chrome.storage.local.get())['e2e.clockOffsetMs']
    const offset = typeof stored === 'number' ? stored : 0
    await chrome.storage.local.set({ 'e2e.clockOffsetMs': offset + delta * 1000 })
  }, seconds)
}
