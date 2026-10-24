// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(EXTENSION_ROOT, 'src')
const SOURCE_FILE = /\.(ts|tsx|css|html|json)$/

// A hex colour (#rgb, #rgba, #rrggbb, #rrggbbaa) or a colour function.
const RAW_COLOUR =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return SOURCE_FILE.test(entry.name) ? [path] : []
  })
}

describe('theme tokens', () => {
  it('tokens_stylesheet_imports_the_generated_design_tokens', () => {
    const css = readFileSync(join(SRC, 'theme/tokens.css'), 'utf8')
    expect(css).toContain("@import '@monki-focus/design-tokens/tokens.css';")
  })

  it('generated_tokens_theme_shadow_hosts_in_both_themes', () => {
    const require = createRequire(join(EXTENSION_ROOT, 'package.json'))
    const css = readFileSync(require.resolve('@monki-focus/design-tokens/tokens.css'), 'utf8')
    // Light defaults, the OS preference and the explicit dark pin all reach
    // the host of a shadow root overlay, not only the document.
    expect(css).toMatch(/:root,\s*:host,/)
    expect(css).toContain(":host(:not([data-theme='light']))")
    expect(css).toContain(":host([data-theme='dark'])")
    expect(css).toContain('--mf-accent:')
  })

  it('no_raw_hex_in_extension_sources', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => RAW_COLOUR.test(line))
        .map(({ index }) => `${relative(EXTENSION_ROOT, file)}:${index + 1}`)
    )
    expect(offenders, 'use a --mf-* token from @monki-focus/design-tokens').toEqual([])
  })
})
