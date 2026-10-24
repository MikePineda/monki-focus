// SPDX-License-Identifier: AGPL-3.0-or-later
import AxeBuilder from '@axe-core/playwright'
import type { BrowserContext, Page } from '@playwright/test'
import type { SyncBlock } from '@monki-focus/analytics'
import {
  commandMessage,
  type CommandRequest,
  type CommandResult,
  type CommandType,
} from '../../src/shared/messages'

/** The extension page's `chrome`, as far as these helpers use it. */
interface ExtensionGlobals {
  chrome: {
    runtime: { sendMessage(message: unknown): Promise<unknown> }
    storage: {
      local: {
        get(key: string): Promise<Record<string, unknown>>
        set(items: object): Promise<void>
      }
    }
  }
}

/** Sends a typed command from an extension page (popup or options) and answers its data. */
export async function sendCommand<T extends CommandType>(
  page: Page,
  type: T,
  payload: CommandRequest<T>
): Promise<CommandResult<T>> {
  return (await page.evaluate(
    (message) => (globalThis as unknown as ExtensionGlobals).chrome.runtime.sendMessage(message),
    commandMessage(type, payload)
  )) as CommandResult<T>
}

/** Writes `storage.local` items from the service worker (test setup only). */
export async function setLocal(context: BrowserContext, items: Record<string, unknown>) {
  const [worker] = context.serviceWorkers()
  if (!worker) throw new Error('the extension service worker is not running')
  await worker.evaluate(
    (values) => (globalThis as unknown as ExtensionGlobals).chrome.storage.local.set(values),
    items
  )
}

export async function getLocal(context: BrowserContext, key: string): Promise<unknown> {
  const [worker] = context.serviceWorkers()
  if (!worker) throw new Error('the extension service worker is not running')
  return worker.evaluate(
    async (name) =>
      (await (globalThis as unknown as ExtensionGlobals).chrome.storage.local.get(name))[name],
    key
  )
}

/**
 * E2E hook: puts synthetic 5-minute blocks straight into the extension's
 * IndexedDB (`monki`, store `blocks`) from one of its pages, which share the
 * service worker's origin. A device id of their own keeps the aggregation
 * job (which only rewrites this device's blocks) from removing them.
 */
export async function seedBlocks(page: Page, blocks: readonly SyncBlock[]): Promise<void> {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('monki')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('blocks', 'readwrite')
          for (const block of rows) {
            tx.objectStore('blocks').put({
              ...block,
              key: [
                block.deviceId,
                block.blockStart,
                block.activityKey ?? '',
                block.categoryPath,
                block.source,
                block.level,
              ],
            })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    blocks
  )
}

export async function countBlocks(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('monki')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const request = db.transaction('blocks').objectStore('blocks').count()
          request.onsuccess = () => {
            db.close()
            resolve(request.result)
          }
          request.onerror = () => reject(request.error)
        }
      })
  )
}

/** Blocks that end before now, inside the current hour or the one before it. */
export function recentBlocks(
  entries: readonly {
    activityKey: string
    level: SyncBlock['level']
    categoryPath: string
    count: number
  }[],
  now = Date.now()
): SyncBlock[] {
  const latest = Math.floor(now / 300_000) * 300_000 - 300_000
  let slot = 0
  return entries.flatMap(({ activityKey, level, categoryPath, count }) =>
    Array.from({ length: count }, () => {
      const blockStart = new Date(latest - slot++ * 300_000).toISOString().replace('.000Z', 'Z')
      return {
        deviceId: 'e2e-seed',
        blockStart,
        activityKey,
        categoryPath,
        level,
        source: 'web' as const,
        seconds: 300,
      }
    })
  )
}

/** axe over the page: serious and critical findings fail; the rest is printed. */
export async function blockingAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  for (const violation of results.violations) {
    console.log(`axe ${violation.impact ?? 'unknown'}: ${violation.id} (${violation.nodes.length})`)
  }
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }))
}
