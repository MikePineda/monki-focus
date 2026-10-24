// SPDX-License-Identifier: AGPL-3.0-or-later
import { commandMessage, type CommandResult } from '../../src/shared/messages'
import { expect, test } from '../support/extensionTest'

/** The extension page's `chrome.runtime`, as far as this spec uses it. */
interface ExtensionPageGlobals {
  chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } }
}

// The e2e build pulses every 2 s (TrackingTiming), so ~3 pulses fit in 7 s.
const THREE_PULSES_MS = 7_000

test('visit_shows_in_stats_api', async ({ context, page, extensionUrl }) => {
  await page.goto('https://www.reddit.com/')
  await expect(page.locator('html')).toHaveAttribute('data-fixture', 'reddit-home')
  await page.waitForTimeout(THREE_PULSES_MS)

  const statsPage = await context.newPage()
  await statsPage.goto(extensionUrl('popup.html'))
  const today = (await statsPage.evaluate(
    (message) =>
      (globalThis as unknown as ExtensionPageGlobals).chrome.runtime.sendMessage(message),
    commandMessage('stats.today', {})
  )) as CommandResult<'stats.today'>

  if (!today.ok) throw new Error(`stats.today failed: ${today.error}`)
  const reddit = today.data.topActivities.find((entry) => entry.activityKey === 'reddit.com')
  // Social sites are Distracting (level 0) in the bundled default categories.
  expect(reddit).toMatchObject({ level: 0 })
  expect(reddit?.seconds).toBeGreaterThanOrEqual(4)
  expect(today.data.pulse).toBe(0)
})
