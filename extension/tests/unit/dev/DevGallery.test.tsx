// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { DevGallery } from '../../../src/dev/DevGallery'
import en from '../../../src/i18n/catalogs/en.json'
import es from '../../../src/i18n/catalogs/es.json'
import { fixedClock } from '../../../src/shared/clock'

const clock = fixedClock('2026-01-05T09:00:00Z')

describe('DevGallery', () => {
  it('gallery_shows_every_theme_in_every_language', () => {
    const { container } = render(<DevGallery clock={clock} />)
    const panels = [...container.querySelectorAll('.dev-panel')]
    expect(
      panels.map((panel) => `${panel.getAttribute('data-theme')}-${panel.getAttribute('lang')}`)
    ).toEqual(['light-en', 'dark-en', 'light-es', 'dark-es'])
  })

  it('each_panel_speaks_its_own_language', () => {
    render(<DevGallery clock={clock} />)
    const [englishLight, , spanishLight] = screen.getAllByRole('region', { name: /·/ })
    expect(
      within(englishLight as HTMLElement).getAllByText(en['dev.sample.closeTab'])
    ).not.toHaveLength(0)
    expect(
      within(spanishLight as HTMLElement).getAllByText(es['dev.sample.closeTab'])
    ).not.toHaveLength(0)
  })

  it('each_panel_shows_every_component', () => {
    const { container } = render(<DevGallery clock={clock} />)
    const panel = container.querySelector('.dev-panel') as HTMLElement
    for (const selector of [
      '.mf-button--leave',
      '.mf-button--ink',
      '.mf-button--secondary',
      '.mf-button--quiet',
      '.mf-segmented',
      '.mf-text-field',
      '.mf-countdown',
      '.mf-progress-line',
      '.mf-stat',
      '.mf-level-bar',
      '.mf-data-table',
      '.mf-banner',
      '.mf-toast',
      '.mf-overlay__card',
      '.mf-list-row',
    ]) {
      expect(panel.querySelector(selector), selector).not.toBeNull()
    }
  })
})
