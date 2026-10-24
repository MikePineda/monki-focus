// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { renderOutputs } from '../src/GeneratedOutputs.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'

const output = (path: string): string => {
  const content = renderOutputs()[path]
  if (content === undefined) throw new Error(`${path} is not generated`)
  return content
}

const blockOf = (css: string, selectorStart: string): string => {
  const start = css.indexOf(selectorStart)
  if (start < 0) throw new Error(`no block starting with ${selectorStart}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('platform formats', () => {
  it('css_puts_light_on_root_and_host_and_dark_behind_the_attribute_and_the_media_query', () => {
    const css = output('dist/tokens.css')
    const tokens = resolveTokens()
    const surface = tokens.color['surface-0']
    if (!surface) throw new Error('surface-0 missing')

    const light = blockOf(css, ":root,\n:host,\n[data-theme='light'] {")
    const media = blockOf(
      css,
      "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']),"
    )
    const dark = blockOf(css, "[data-theme='dark'],\n:host([data-theme='dark']) {")

    expect(light).toContain(`--mf-surface-0: ${surface.light};`)
    expect(light).toContain('color-scheme: light;')
    expect(media).toContain(`--mf-surface-0: ${surface.dark};`)
    expect(dark).toContain(`--mf-surface-0: ${surface.dark};`)
    expect(dark).toContain('color-scheme: dark;')
    expect(css.indexOf('@media')).toBeLessThan(css.indexOf("[data-theme='dark'],"))
  })

  it('css_carries_typography_spacing_radius_and_motion', () => {
    const css = output('dist/tokens.css')

    for (const declaration of [
      '--mf-font-family-sans: Inter,',
      '--mf-type-countdown-size: 96px;',
      '--mf-type-countdown-numeric: tabular-nums;',
      '--mf-space-md: 16px;',
      '--mf-radius-md: 8px;',
      '--mf-duration-fast: 150ms;',
      '--mf-easing-standard: cubic-bezier(0.2, 0, 0, 1);',
    ]) {
      expect(css).toContain(declaration)
    }
  })

  it('css_variables_are_prefixed', () => {
    const css = output('dist/tokens.css')
    const declared = [...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((match) => match[1])

    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((name) => !name?.startsWith('--mf-'))).toEqual([])
    expect(css).not.toMatch(/var\(--(?!mf-)/)
  })

  it('compose_colors_live_in_the_core_ui_theme_package_with_material_schemes', () => {
    const kotlin = output('dist/android/MonkiColors.kt')

    expect(kotlin).toContain('package dev.monkifocus.android.core.ui.theme\n')
    expect(kotlin).toContain('val MonkiLightColorScheme: ColorScheme = lightColorScheme(')
    expect(kotlin).toContain('val MonkiDarkColorScheme: ColorScheme = darkColorScheme(')
    expect(kotlin).toContain('data class MonkiColors(')
    expect(kotlin).toContain('val LocalMonkiColors = staticCompositionLocalOf { MonkiLightColors }')
    expect(kotlin).toMatch(/level0 = Color\(0xFF[0-9A-F]{6}\)/)
  })

  it('every_kotlin_output_shares_the_theme_package', () => {
    for (const [path, content] of Object.entries(renderOutputs())) {
      if (path.endsWith('.kt')) {
        expect(content, path).toContain('package dev.monkifocus.android.core.ui.theme\n')
      }
    }
  })

  it('swift_colors_are_dynamic_without_an_asset_catalog', () => {
    const swift = output('dist/macos/MonkiColors.swift')

    expect(swift).toContain('extension Color {')
    expect(swift).toContain('NSColor(name: nil, dynamicProvider:')
    expect(swift).toMatch(/public static let monkiSurface0 = Color\.monkiDynamic\(/)
    expect(swift).not.toContain('Color("')
  })
})
