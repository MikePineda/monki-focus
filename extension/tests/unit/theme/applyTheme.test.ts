// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme } from '../../../src/theme/applyTheme'

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.body.replaceChildren()
  })

  it('dark_preference_sets_data_theme_dark_on_the_document', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('light_preference_pins_the_light_theme', () => {
    applyTheme('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('system_preference_removes_data_theme_so_the_os_decides', () => {
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('theme_applies_to_a_shadow_host', () => {
    // Overlays live in a shadow root; tokens.css themes `:host([data-theme])`.
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' })
    document.body.append(host)

    applyTheme('dark', host)

    expect(host).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })
})
