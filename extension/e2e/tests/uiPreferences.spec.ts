// SPDX-License-Identifier: AGPL-3.0-or-later
import es from '../../src/i18n/catalogs/es.json' with { type: 'json' }
import { expect, test } from '../support/extensionTest'

test.describe('stored UI preferences', () => {
  test.use({ locale: 'en-US' })

  test('stored_theme_and_language_override_the_browser_on_the_popup', async ({
    context,
    page,
    extensionUrl,
  }) => {
    const [worker] = context.serviceWorkers()
    if (!worker) throw new Error('the extension service worker is not running')
    // Runs inside the service worker, where `chrome` is the extension API.
    await worker.evaluate(() => {
      const { chrome } = globalThis as unknown as {
        chrome: { storage: { local: { set(items: object): Promise<void> } } }
      }
      return chrome.storage.local.set({ 'ui.theme': 'dark', 'ui.language': 'es' })
    })
    await page.emulateMedia({ colorScheme: 'light' })

    await page.goto(extensionUrl('popup.html'))

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es['popup.title'])
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe('dark')
  })
})
