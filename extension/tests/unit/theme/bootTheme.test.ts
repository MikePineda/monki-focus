// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cacheTheme } from '../../../src/theme/ThemeCache'

const ENTRYPOINTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/entrypoints')

describe('bootTheme', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('theme_boot_applies_the_cached_theme_as_soon_as_it_loads', async () => {
    cacheTheme('dark')
    vi.resetModules()

    await import('../../../src/theme/bootTheme')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('every_page_boots_its_theme_from_a_module_script_in_head_without_inline_code', () => {
    const pages = readdirSync(ENTRYPOINTS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(ENTRYPOINTS, entry.name, 'index.html'))
      // Content-script folders (`*.content/`) have no page.
      .filter((page) => existsSync(page))
    expect(pages.length).toBeGreaterThan(0)

    for (const page of pages) {
      const html = readFileSync(page, 'utf8')
      const head = html.slice(0, html.indexOf('</head>'))
      expect(head, page).toMatch(
        /<script type="module" src="\.\.\/\.\.\/theme\/bootTheme\.ts"><\/script>/
      )
      // MV3 CSP: every script has a src; none carries inline code.
      expect(html, page).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/)
    }
  })
})
