// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '../support/extensionTest'

test('reddit_home_is_served_by_the_local_fixture_server', async ({ page }) => {
  const response = await page.goto('https://www.reddit.com/')

  expect(response?.status()).toBe(200)
  expect(page.url()).toBe('https://www.reddit.com/')
  await expect(page.locator('html')).toHaveAttribute('data-fixture', 'reddit-home')
  await expect(page.locator('shreddit-app shreddit-feed article')).toHaveCount(2)
})

test('hosts_outside_the_fixture_sites_never_reach_the_network', async ({ page }) => {
  await expect(page.goto('https://example.com/')).rejects.toThrow(/ERR_NAME_NOT_RESOLVED/)
})
