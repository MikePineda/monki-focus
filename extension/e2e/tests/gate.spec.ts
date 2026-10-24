// SPDX-License-Identifier: AGPL-3.0-or-later
import AxeBuilder from '@axe-core/playwright'
import { activityWatchBucketId } from '@monki-focus/analytics'
import type { BrowserContext, Page } from '@playwright/test'
import {
  advanceClock,
  extensionWorker,
  starterRuleset,
  useRuleset,
} from '../support/extensionStorage'
import { expect, test } from '../support/extensionTest'

const REDDIT_POST = 'https://www.reddit.com/r/examplesub/comments/fixture1/first_synthetic_post/'
const REDDIT_GROUP = 'starter-reddit-friction'

test.use({ startingRuleset: 'gated', locale: 'en-US' })

async function expectGate(page: Page) {
  await expect(page).toHaveURL(/^chrome-extension:\/\/[^/]+\/gate\.html$/)
}

/** The big countdown's number (seconds left). */
async function pauseSecondsLeft(page: Page): Promise<number> {
  const text = await page.locator('.mf-countdown__value').textContent()
  return Number(text)
}

/** Waits out the pause on the e2e clock and answers the asking form. */
async function skipPause(context: BrowserContext, page: Page, seconds: number) {
  await expect(page.locator('.mf-countdown__value')).toBeVisible()
  await advanceClock(context, seconds)
  await expect(page.getByRole('textbox', { name: 'What are you here for?' })).toBeVisible()
}

async function commit(page: Page, minutes: 5 | 10 | 15, intention = '') {
  if (intention) await page.getByRole('textbox', { name: 'What are you here for?' }).fill(intention)
  await page.getByRole('radio', { name: `${minutes} min`, exact: true }).check()
  await page.getByRole('button', { name: 'Continue to reddit.com' }).click()
}

/** Every record of the extension's outbox (IndexedDB `monki`). */
function outboxEntries(context: BrowserContext): Promise<unknown[]> {
  return extensionWorker(context).evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('monki')
        open.onerror = () => reject(new Error('open failed'))
        open.onsuccess = () => {
          const request = open.result.transaction('outbox').objectStore('outbox').getAll()
          request.onsuccess = () => resolve(request.result as unknown[])
          request.onerror = () => reject(new Error('read failed'))
        }
      })
  )
}

test('gate_shows_on_first_visit_and_close_closes_tab', async ({ context, page }) => {
  // Another tab keeps the window open, so Close closes only the gate's tab.
  await context.newPage()

  await page.goto(REDDIT_POST)

  await expectGate(page)
  await expect(page.getByText('reddit.com · 1 visit today · 0 min today')).toBeVisible()
  const close = page.getByRole('button', { name: 'Close tab' })
  await expect(close).toBeFocused()
  await expect(page.getByText('A short pause before you decide.')).toBeVisible()

  const closed = page.waitForEvent('close')
  await close.click()
  await closed
})

test('reloading_gate_does_not_reset_pause', async ({ context, page }) => {
  await page.goto(REDDIT_POST)
  await expectGate(page)
  expect(await pauseSecondsLeft(page)).toBeGreaterThanOrEqual(4)

  await advanceClock(context, 3)
  await page.reload()

  await expectGate(page)
  await expect(page.locator('.mf-countdown__value')).toBeVisible()
  expect(await pauseSecondsLeft(page)).toBeLessThanOrEqual(2)
  await expect(page.getByText('reddit.com · 1 visit today · 0 min today')).toBeVisible()
})

test('committed_intention_allows_site_then_timeout_overlay_appears', async ({ context, page }) => {
  await page.goto(REDDIT_POST)
  await expectGate(page)
  await skipPause(context, page, 5)

  await commit(page, 5, 'read the first post')

  await expect(page).toHaveURL(REDDIT_POST)
  await expect(page.getByRole('timer', { name: 'Time left for your intention' })).toHaveText(
    /^[45]:\d\d$/
  )

  await advanceClock(context, 300)

  const overlay = page.getByRole('dialog', { name: 'Your 5 min for “read the first post” are up.' })
  await expect(overlay).toBeVisible()
  await expect(page.getByRole('button', { name: 'Leave reddit.com' })).toBeFocused()
})

test('extend_doubles_next_pause', async ({ context, page }) => {
  await page.goto(REDDIT_POST)
  await expectGate(page)
  await skipPause(context, page, 5)
  await commit(page, 5)
  await expect(page).toHaveURL(REDDIT_POST)
  await advanceClock(context, 300)
  await expect(
    page.getByText('Counts as a broken intention · next pause will be 10 s')
  ).toBeVisible()

  await page.getByRole('button', { name: '5 more min' }).click()

  await expectGate(page)
  await expect(page.getByText('Extending doubles the pause. Then 5 more minutes.')).toBeVisible()
  expect(await pauseSecondsLeft(page)).toBeGreaterThan(5)
  expect(await pauseSecondsLeft(page)).toBeLessThanOrEqual(10)
  await advanceClock(context, 10)
  await expect(page).toHaveURL(REDDIT_POST)
})

test('emergency_override_waits_then_grants_access_and_records_bypass', async ({
  context,
  page,
}) => {
  await page.goto(REDDIT_POST)
  await expectGate(page)

  await page.getByRole('button', { name: 'Emergency' }).click()

  await expect(page.getByRole('heading', { name: 'Emergency access' })).toBeVisible()
  await expect(page.locator('.mf-countdown__value')).toHaveText(/^(2:00|1:5\d)$/)
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await advanceClock(context, 120)

  await expect(page).toHaveURL(REDDIT_POST)
  const entries = await outboxEntries(context)
  const bypasses = entries.filter((entry) => (entry as { kind?: string }).kind === 'bypass')
  expect(bypasses).toHaveLength(1)
  expect(bypasses[0]).toMatchObject({
    payload: { kind: 'emergency_override', details: { targetGroup: REDDIT_GROUP } },
  })
  expect(JSON.stringify(bypasses)).not.toContain('reddit.com')
})

test('budget_block_offers_only_close_and_emergency', async ({ context, page }) => {
  const worker = extensionWorker(context)
  const device = await worker.evaluate(async () => {
    const { chrome } = globalThis as unknown as {
      chrome: { storage: { local: { get(key: string): Promise<Record<string, unknown>> } } }
    }
    return (await chrome.storage.local.get('device.id'))['device.id'] as string
  })
  // Two tracked minutes on Reddit today, against a one-minute budget.
  await worker.evaluate(
    ({ bucketId, timestamp }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('monki')
        open.onerror = () => reject(new Error('open failed'))
        open.onsuccess = () => {
          const tx = open.result.transaction('events', 'readwrite')
          tx.objectStore('events').add({
            bucketId,
            timestamp,
            duration: 120,
            data: {
              domain: 'reddit.com',
              path: '/',
              surface: null,
              audible: false,
              incognito: false,
            },
          })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(new Error('write failed'))
        }
      }),
    {
      bucketId: activityWatchBucketId('web.tab.current', device),
      timestamp: new Date(Math.floor(Date.now() / 1000) * 1000 - 180_000)
        .toISOString()
        .replace('.000Z', 'Z'),
    }
  )
  const ruleset = starterRuleset({ friction: true })
  await useRuleset(
    context,
    {
      ...ruleset,
      rules: ruleset.rules.map((rule) =>
        rule.id === REDDIT_GROUP ? { ...rule, dailyBudgetMinutes: 1 } : rule
      ),
    },
    2
  )

  await page.goto(REDDIT_POST)

  await expectGate(page)
  await expect(
    page.getByRole('heading', { name: "Today's time for reddit.com is used up." })
  ).toBeVisible()
  await expect(page.getByRole('button')).toHaveText(['Close tab', 'Emergency'])
  await expect(page.getByRole('textbox')).toHaveCount(0)
})

test('gate_ignores_destination_in_query', async ({ page, extensionUrl }) => {
  for (const query of [
    '?to=https://evil.example/',
    `?t=${'q'.repeat(32)}&to=https://evil.example/`,
  ]) {
    await page.goto(extensionUrl(`gate.html${query}`))

    await expect(page.getByRole('heading', { name: 'Nothing to continue to' })).toBeVisible()
    await expect(page.getByRole('button')).toHaveText(['Close tab'])
    await page.waitForTimeout(300)
    await expectGate(page)
  }
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`gate_has_no_serious_or_critical_accessibility_violations_in_${colorScheme}`, async ({
    context,
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto(REDDIT_POST)
    await expectGate(page)

    for (const state of ['pausing', 'asking'] as const) {
      if (state === 'asking') await skipPause(context, page, 5)
      else await expect(page.locator('.mf-countdown__value')).toBeVisible()
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      const blocking = results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => node.target.join(' ')),
        }))
      expect(blocking, `${state} in ${colorScheme}`).toEqual([])
    }
  })
}
