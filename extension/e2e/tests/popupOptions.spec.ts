// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import type { Ruleset } from '@monki-focus/rules/pure'
import en from '../../src/i18n/catalogs/en.json' with { type: 'json' }
import es from '../../src/i18n/catalogs/es.json' with { type: 'json' }
import {
  blockingAxeViolations,
  countBlocks,
  getLocal,
  recentBlocks,
  seedBlocks,
  sendCommand,
  setLocal,
} from '../support/extensionPages'
import { expect, test } from '../support/extensionTest'

/** A fixed-offset zone where it is about midday now, so seeded blocks are "today". */
function middayTimeZone(now = new Date()): string {
  const offset = 12 - now.getUTCHours()
  if (offset === 0) return 'Etc/GMT'
  // POSIX sign: Etc/GMT-3 is UTC+3.
  return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`
}

/** Pins the stored rule set to a midday zone (test setup; the store follows storage). */
async function pinMiddayZone(context: BrowserContext, page: Page) {
  const state = await sendCommand(page, 'rules.state', {})
  if (!state.ok) throw new Error(`rules.state failed: ${state.error}`)
  await setLocal(context, {
    'rules.ruleset': { ...state.data.effective, timeZone: middayTimeZone() },
  })
}

async function effectiveRule(page: Page, id: string) {
  const state = await sendCommand(page, 'rules.state', {})
  if (!state.ok) throw new Error(`rules.state failed: ${state.error}`)
  return state.data.effective.rules.find((rule) => rule.id === id)
}

async function editRedditMode(page: Page, mode: string) {
  await page.getByRole('button', { name: 'Edit reddit.com' }).click()
  const editor = page.getByRole('form', { name: 'Edit the rule for reddit.com' })
  await editor.getByLabel(en['rules.editor.mode']).selectOption(mode)
  await editor.getByRole('button', { name: en['rules.editor.save'] }).click()
}

const SITE_TABLE = { name: en['rules.sites.title'] }

test.describe('popup and options', () => {
  test.use({ locale: 'en-US' })

  test('popup_shows_today_pulse_and_top_sites', async ({ context, page, extensionUrl }) => {
    await page.goto(extensionUrl('popup.html'))
    await pinMiddayZone(context, page)
    await seedBlocks(
      page,
      recentBlocks([
        { activityKey: 'docs.example', level: 100, categoryPath: 'development', count: 3 },
        { activityKey: 'news.example', level: 0, categoryPath: 'social', count: 1 },
      ])
    )

    await page.reload()

    const pulse = page.getByRole('group', { name: en['popup.pulse.label'] })
    await expect(pulse).toContainText('75')
    await expect(pulse).toContainText('of 100 · 20 min tracked')
    const rows = page.getByRole('table', { name: en['popup.topSites.title'] }).getByRole('row')
    await expect(rows.nth(1)).toHaveText(/docs\.example\s*15\s*Focus/)
    await expect(rows.nth(2)).toHaveText(/news\.example\s*5\s*Distracting/)
    await expect(page.getByRole('switch')).toHaveCount(0)
  })

  test('tightening_a_rule_applies_immediately', async ({ page, extensionUrl }) => {
    await page.goto(extensionUrl('options.html#rules'))
    await expect(page.getByRole('table', SITE_TABLE)).toBeVisible()

    await editRedditMode(page, 'block')

    await expect(page.getByText(en['rules.feedback.applied'])).toBeVisible()
    expect(await effectiveRule(page, 'starter-reddit-friction')).toMatchObject({ mode: 'block' })
    await expect(page.getByRole('button', { name: en['rules.pending.cancel'] })).toHaveCount(0)
  })

  test('loosening_a_rule_shows_pending_until_effective', async ({
    context,
    page,
    extensionUrl,
  }) => {
    await page.goto(extensionUrl('options.html#rules'))
    await expect(page.getByRole('table', SITE_TABLE)).toBeVisible()

    await editRedditMode(page, 'allow')

    await expect(page.getByText('Rule changed for reddit.com')).toBeVisible()
    await expect(page.getByRole('table', SITE_TABLE)).toContainText(/reddit\.comAllow.*Waiting/)
    expect(await effectiveRule(page, 'starter-reddit-friction')).toMatchObject({
      mode: 'friction',
    })

    // Its time comes: the service worker applies it in full on the next read.
    const pending = (await getLocal(context, 'rules.pending')) as { ruleset: Ruleset }
    await setLocal(context, {
      'rules.pending': { ...pending, effectiveFrom: '2026-01-01T00:00:00Z' },
    })
    await page.reload()

    await expect(page.getByRole('table', SITE_TABLE)).toContainText(/reddit\.comAllow.*In force/)
    await expect(page.getByRole('button', { name: en['rules.pending.cancel'] })).toHaveCount(0)
    expect(await effectiveRule(page, 'starter-reddit-friction')).toMatchObject({ mode: 'allow' })
  })

  test('cancelling_a_pending_loosening_keeps_the_current_rule', async ({ page, extensionUrl }) => {
    await page.goto(extensionUrl('options.html#rules'))
    await expect(page.getByRole('table', SITE_TABLE)).toBeVisible()
    await editRedditMode(page, 'allow')

    await page.getByRole('button', { name: en['rules.pending.cancel'] }).click()

    await expect(page.getByText(en['rules.feedback.cancelled'])).toBeVisible()
    await expect(page.getByRole('table', SITE_TABLE)).toContainText(
      /reddit\.comPause first.*In force/
    )
    expect(await effectiveRule(page, 'starter-reddit-friction')).toMatchObject({
      mode: 'friction',
    })
  })

  test('language_and_theme_preferences_apply', async ({ page, extensionUrl }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(extensionUrl('options.html#preferences'))

    await page.getByLabel(en['preferences.theme'], { exact: true }).selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByLabel(en['preferences.language'], { exact: true }).selectOption('es')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es['options.title'])
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await page.goto(extensionUrl('popup.html'))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es['popup.title'])
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe('dark')
  })

  test('delete_all_local_data_requires_confirmation', async ({ context, page, extensionUrl }) => {
    await page.goto(extensionUrl('options.html#stats'))
    await pinMiddayZone(context, page)
    const [today] = recentBlocks([
      { activityKey: 'news.example', level: 0, categoryPath: 'social', count: 1 },
    ])
    if (!today) throw new Error('needs a block')
    const threeDaysAgo = new Date(Date.parse(today.blockStart) - 3 * 86_400_000)
    const old = { ...today, blockStart: threeDaysAgo.toISOString().replace('.000Z', 'Z') }
    await seedBlocks(page, [today, old])

    await page.getByRole('button', { name: en['stats.data.delete'] }).click()

    await expect(page.getByText(en['stats.data.confirmTitle'])).toBeVisible()
    await expect(page.getByRole('button', { name: en['stats.data.cancel'] })).toBeFocused()
    expect(await countBlocks(page)).toBe(2)

    await page.getByRole('button', { name: en['stats.data.confirmDelete'] }).click()

    await expect(page.getByText(en['stats.data.deleted'])).toBeVisible()
    // History goes; today's block stays so a delete cannot reset a daily budget.
    expect(await countBlocks(page)).toBe(1)
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`popup_has_no_serious_or_critical_accessibility_violations_in_${colorScheme}`, async ({
      context,
      page,
      extensionUrl,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(extensionUrl('popup.html'))
      await pinMiddayZone(context, page)
      await seedBlocks(
        page,
        recentBlocks([
          { activityKey: 'docs.example', level: 100, categoryPath: 'development', count: 2 },
        ])
      )
      await page.reload()
      await expect(page.getByRole('table', { name: en['popup.topSites.title'] })).toBeVisible()

      expect(await blockingAxeViolations(page)).toEqual([])
      await page.getByRole('radio', { name: en['chartTable.table'] }).check()
      await expect(page.getByRole('table', { name: en['popup.levels.title'] })).toBeVisible()
      expect(await blockingAxeViolations(page)).toEqual([])
    })

    test(`options_have_no_serious_or_critical_accessibility_violations_in_${colorScheme}`, async ({
      page,
      extensionUrl,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      for (const section of ['rules', 'preferences', 'stats', 'about'] as const) {
        await page.goto(extensionUrl(`options.html#${section}`))
        await expect(page.getByRole('heading', { level: 2 })).toHaveText(
          en[`options.section.${section}`]
        )
        await expect(page.getByText(en['options.loading'])).toHaveCount(0)
        expect({ section, violations: await blockingAxeViolations(page) }).toEqual({
          section,
          violations: [],
        })
      }
    })
  }
})
