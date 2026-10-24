// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import en from '../../src/i18n/catalogs/en.json' with { type: 'json' }
import { expect, test } from '../support/extensionTest'
import { E2E_BUILD_DIR } from '../support/launchExtension'

const COLOR_SCHEMES = ['light', 'dark'] as const

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

const backgroundOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor)

test.describe('UI kit gallery (dev build)', () => {
  test.use({ extensionBuild: 'dev', locale: 'en-US' })

  for (const colorScheme of COLOR_SCHEMES) {
    test(`dev_page_renders_both_themes_and_languages_with_a_${colorScheme}_system_theme`, async ({
      page,
      extensionUrl,
    }) => {
      const errors = collectErrors(page)
      await page.emulateMedia({ colorScheme })

      await page.goto(extensionUrl('dev.html'))

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['dev.title'])
      await expect(page.locator('.dev-panel')).toHaveCount(4)
      await expect(page.locator('.dev-panel[lang="es"]')).toHaveCount(2)
      // The page follows the system theme; each panel pins its own.
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
      ).toBe(colorScheme)
      expect(await backgroundOf(page, '.dev-panel[data-theme="light"]')).not.toBe(
        await backgroundOf(page, '.dev-panel[data-theme="dark"]')
      )
      expect(errors).toEqual([])
    })

    test(`dev_page_has_no_serious_or_critical_accessibility_violations_with_a_${colorScheme}_system_theme`, async ({
      page,
      extensionUrl,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(extensionUrl('dev.html'))
      await expect(page.locator('.dev-panel')).toHaveCount(4)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()

      // Minor and moderate findings are printed for the record, not failed on.
      console.log(
        `axe: ${results.passes.length} rules passed, ${results.violations.length} violated`
      )
      for (const violation of results.violations) {
        console.log(
          `axe ${violation.impact ?? 'unknown'}: ${violation.id} (${violation.nodes.length})`
        )
      }
      const blocking = results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => node.target.join(' ')),
        }))
      expect(blocking).toEqual([])
    })
  }
})

test('e2e_build_never_contains_the_dev_page', () => {
  expect(existsSync(join(E2E_BUILD_DIR, 'dev.html'))).toBe(false)
  expect(readFileSync(join(E2E_BUILD_DIR, 'manifest.json'), 'utf8')).not.toContain('dev.html')
})
