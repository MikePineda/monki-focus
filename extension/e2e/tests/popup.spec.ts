// SPDX-License-Identifier: AGPL-3.0-or-later
import en from '../../src/i18n/catalogs/en.json' with { type: 'json' }
import es from '../../src/i18n/catalogs/es.json' with { type: 'json' }
import { expect, test } from '../support/extensionTest'

test.describe('popup in English', () => {
  test.use({ locale: 'en-US' })

  test('popup_opens_with_the_english_heading', async ({ page, extensionUrl }) => {
    await page.goto(extensionUrl('popup.html'))

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['popup.title'])
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle(en['popup.title'])
  })
})

test.describe('popup in Spanish', () => {
  test.use({ locale: 'es-MX' })

  test('popup_opens_with_the_spanish_heading', async ({ page, extensionUrl }) => {
    await page.goto(extensionUrl('popup.html'))

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(es['popup.title'])
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })
})
