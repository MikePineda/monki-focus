// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src')
const css = readFileSync(join(SRC, 'theme/inter.css'), 'utf8')

describe('Inter', () => {
  it('inter_is_bundled_with_only_the_latin_and_latin_ext_subsets', () => {
    const sources = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1])

    expect(sources).toEqual([
      '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
      '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    ])
    expect(css).not.toMatch(/https?:\/\//)
  })

  it('every_face_swaps_and_is_named_like_the_token_stack', () => {
    const faces = css.match(/@font-face\s*{[^}]*}/g) ?? []

    expect(faces).toHaveLength(2)
    for (const face of faces) {
      expect(face).toContain('font-display: swap;')
      expect(face).toContain('font-family: Inter;')
    }
  })

  it('every_extension_page_loads_inter', () => {
    expect(readFileSync(join(SRC, 'ui/startPage.tsx'), 'utf8')).toContain(
      "import '../theme/inter.css'"
    )
  })
})
