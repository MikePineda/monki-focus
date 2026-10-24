// SPDX-License-Identifier: AGPL-3.0-or-later
import { starterPreset, type Ruleset } from '@monki-focus/rules/pure'
import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '../support/extensionTest'

/** The slice of the service worker's `chrome` global the specs use. */
interface WorkerGlobal {
  chrome: {
    storage: {
      local: {
        get(): Promise<Record<string, unknown>>
        set(items: Record<string, unknown>): Promise<void>
      }
    }
  }
}

const REDDIT_PERMALINK =
  'https://www.reddit.com/r/examplesub/comments/fixture1/first_synthetic_post/'

/** A starter rule set that shows the Reddit feed (and no bedtime). */
function rulesetShowingRedditFeed(): Ruleset {
  return {
    ...structuredClone(starterPreset),
    rules: starterPreset.rules.filter((rule) => rule.id !== 'starter-reddit-feed-hide'),
    bedtime: { ...starterPreset.bedtime, enabled: false },
  }
}

/** Writes `storage.local` from the service worker, as the extension itself would. */
async function setExtensionStorage(context: BrowserContext, items: Record<string, unknown>) {
  const [worker] = context.serviceWorkers()
  if (!worker) throw new Error('extension service worker is not running')
  // Wait for the worker to create the starter rule set first, so it cannot
  // overwrite the one this spec writes.
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

/** The page's random guard attribute names (named on `<html>` by E2E builds only). */
async function guardAttributes(page: Page): Promise<{ hide: string; restrict: string }> {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-mf-e2e-attributes', /^data-[a-z]+ data-[a-z]+$/)
  const [hide = '', restrict = ''] = (
    (await html.getAttribute('data-mf-e2e-attributes')) ?? ''
  ).split(' ')
  return { hide, restrict }
}

/** Waits for a service-worker answer, then checks the restricted surfaces it set. */
async function expectDecisionApplied(page: Page, restrict: string) {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-mf-e2e-applied', /\d+/)
  await expect(html).toHaveAttribute((await guardAttributes(page)).restrict, restrict)
}

const placeholderHeading = (page: Page) => page.getByRole('heading', { name: 'Feed hidden' })

test('reddit_home_feed_is_hidden_and_post_is_shown', async ({ page }) => {
  await page.goto('https://www.reddit.com/')

  await expect(page.locator('shreddit-feed')).toBeHidden()
  await expect(placeholderHeading(page)).toBeVisible()
  await expect(page.getByLabel('Search Reddit')).toBeVisible()

  await page.goto(REDDIT_PERMALINK)

  await expectDecisionApplied(page, 'reddit.feed')
  await expect(page.locator('shreddit-post')).toBeVisible()
  await expect(page.locator('shreddit-comment')).toBeVisible()
  await expect(placeholderHeading(page)).toHaveCount(0)
})

test('x_for_you_hidden_following_visible', async ({ page }) => {
  await page.goto('https://x.com/home')
  const timeline = page.locator('section[role="region"]')

  await expect(timeline).toBeHidden()
  await expect(placeholderHeading(page)).toBeVisible()
  await expect(page.locator('a[data-testid="AppTabBar_Explore_Link"]')).toBeHidden()

  // The placeholder's Following action selects the page's own second tab.
  await page.getByRole('button', { name: 'Following' }).click()

  await expect(page.locator('[data-fixture-tab="second"]')).toHaveAttribute('aria-selected', 'true')
  await expect(timeline).toBeVisible()
  await expect(placeholderHeading(page)).toHaveCount(0)

  // A pinned list is a chosen timeline too; back on "For you" it hides again.
  await page.locator('[data-fixture-tab="list"]').click()
  await expect(timeline).toBeVisible()
  await page.locator('[data-fixture-tab="first"]').click()
  await expect(timeline).toBeHidden()
})

test('youtube_home_hides_shorts_shelf', async ({ page }) => {
  await page.goto('https://www.youtube.com/')

  await expect(page.locator('ytd-rich-grid-renderer')).toBeHidden()
  await expect(page.locator('ytd-rich-shelf-renderer[is-shorts]')).toBeHidden()
  await expect(page.locator('[data-fixture="guide-shorts"]')).toBeHidden()
  await expect(page.locator('[data-fixture="guide-subscriptions"]')).toBeVisible()
  await expect(page.getByLabel('Search YouTube')).toBeVisible()

  // Shorts shelves stay hidden on pages that are not feeds (search results).
  await page.goto('https://www.youtube.com/results?search_query=bread')

  await expect(page.locator('ytd-reel-shelf-renderer')).toBeHidden()
  await expect(page.locator('ytd-video-renderer')).toBeVisible()
  await expect(placeholderHeading(page)).toHaveCount(0)
})

test('m_youtube_home_feed_is_hidden', async ({ page }) => {
  await page.goto('https://m.youtube.com/')

  await expect(page.locator('ytm-rich-grid-renderer')).toBeHidden()
  await expect(page.locator('ytm-reel-shelf-renderer')).toBeHidden()
  await expect(page.locator('[data-fixture="pivot-shorts"]')).toBeHidden()
  await expect(page.locator('[data-fixture="pivot-subscriptions"]')).toBeVisible()
  await expect(placeholderHeading(page)).toBeVisible()
  await expect(page.getByLabel('Search YouTube')).toBeVisible()
})

test('shorts_url_redirects_to_watch', async ({ page }) => {
  // Chromium silently skips a static rule whose regex exceeds its memory
  // cap, so every rule of the ruleset is exercised by a real navigation.
  await page.goto('https://www.youtube.com/shorts/abcdefghijk')

  expect(page.url()).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  await expect(page.locator('html')).toHaveAttribute('data-fixture', 'youtube-watch')

  await page.goto('https://www.youtube.com/shorts/abc_DEF-123/')
  expect(page.url()).toBe('https://www.youtube.com/watch?v=abc_DEF-123')

  await page.goto('https://m.youtube.com/shorts/ZYXWVUTSRQP?feature=share')
  expect(page.url()).toBe('https://www.youtube.com/watch?v=ZYXWVUTSRQP')
})

test('spa_navigation_to_shorts_redirects', async ({ page }) => {
  await page.goto('https://www.youtube.com/')
  await expect(placeholderHeading(page)).toBeVisible()

  await page.locator('#open-short').click()

  await page.waitForURL('https://www.youtube.com/watch?v=abcdefghijk')
  await expect(page.locator('html')).toHaveAttribute('data-fixture', 'youtube-watch')
})

test('push_state_without_events_shows_no_feed_after_300_ms', async ({ page }) => {
  await page.goto(REDDIT_PERMALINK)
  await expectDecisionApplied(page, 'reddit.feed')

  // pushState plus a freshly rendered feed: no popstate, no title change.
  await page.locator('#silent-home').click()

  await expect(page.locator('shreddit-feed')).toBeHidden({ timeout: 300 })
})

test('instagram_reels_and_explore_hidden_direct_visible', async ({ page }) => {
  for (const path of ['/reels/', '/explore/']) {
    await page.goto(`https://www.instagram.com${path}`)

    await expect(page.locator('main[role="main"]')).toBeHidden()
    await expect(placeholderHeading(page)).toBeVisible()
  }

  await page.goto('https://www.instagram.com/direct/inbox/')

  await expectDecisionApplied(page, 'instagram.explore instagram.reels')
  await expect(page.locator('main[role="main"]')).toBeVisible()
  await expect(page.locator('nav a[href="/reels/"]')).toBeHidden()
  await expect(page.locator('nav a[href="/explore/"]')).toBeHidden()
  await expect(page.locator('nav a[href="/direct/inbox/"]')).toBeVisible()
  await expect(page.locator('nav a[href="/explore/search/"]')).toBeVisible()
  await expect(placeholderHeading(page)).toHaveCount(0)

  // The home feed is not hidden by the starter rule set.
  await page.goto('https://www.instagram.com/')

  await expectDecisionApplied(page, 'instagram.explore instagram.reels')
  await expect(page.locator('main[role="main"]')).toBeVisible()
})

test('page_removing_the_guard_style_cannot_reveal_the_feed', async ({ page }) => {
  await page.goto('https://www.reddit.com/')
  await expectDecisionApplied(page, 'reddit.feed')

  // Every <style> the page can reach goes; the feed is read in the same
  // task, before the guard's observer could put its own back.
  const display = await page.evaluate(() => {
    for (const style of document.querySelectorAll('style')) style.remove()
    const feed = document.querySelector('shreddit-feed')
    return feed ? getComputedStyle(feed).display : 'missing'
  })

  expect(display).toBe('none')
  await expect(page.locator('shreddit-feed')).toBeHidden()
})

test('page_removing_hide_attribute_is_reverted', async ({ page }) => {
  await page.goto('https://www.reddit.com/')
  await expectDecisionApplied(page, 'reddit.feed')
  const { hide } = await guardAttributes(page)

  await page.evaluate((name) => document.documentElement.removeAttribute(name), hide)

  await expect(page.locator('html')).toHaveAttribute(hide, 'reddit.feed')
  await expect(page.locator('shreddit-feed')).toBeHidden()
})

test('rule_set_change_reaches_an_open_tab', async ({ context, page }) => {
  await page.goto('https://www.reddit.com/')
  await expect(page.locator('shreddit-feed')).toBeHidden()
  await expectDecisionApplied(page, 'reddit.feed')

  await setExtensionStorage(context, { 'rules.ruleset': rulesetShowingRedditFeed() })

  await expect(page.locator('shreddit-feed')).toBeVisible()
  await expect(placeholderHeading(page)).toHaveCount(0)
})

test('feed_stays_hidden_if_background_is_slow', async ({ context, page }) => {
  // A rule set that shows the Reddit feed, answered 4 s late.
  await setExtensionStorage(context, {
    'rules.ruleset': rulesetShowingRedditFeed(),
    'e2e.decisionDelayMs': 4000,
  })

  await page.goto('https://www.reddit.com/')
  await page.waitForTimeout(2000)

  // Past the 1.5 s timeout: still hidden (fail closed), placeholder shown.
  await expect(page.locator('shreddit-feed')).toBeHidden()
  await expect(placeholderHeading(page)).toBeVisible()

  // The late answer still applies: this rule set shows the feed.
  await expect(page.locator('shreddit-feed')).toBeVisible({ timeout: 10_000 })
  await expect(placeholderHeading(page)).toHaveCount(0)
})
