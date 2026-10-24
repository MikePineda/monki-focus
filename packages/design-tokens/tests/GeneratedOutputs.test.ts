// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderDesignDocs } from '../src/docs/DesignDocs.ts'
import { renderOutputs } from '../src/GeneratedOutputs.ts'
import { PACKAGE_ROOT, REPO_ROOT } from '../src/PackagePaths.ts'

const committed = (root: string, path: string): string => {
  try {
    return readFileSync(join(root, path), 'utf8')
  } catch {
    return `<missing ${path}>`
  }
}

describe('generated outputs', () => {
  it('generated_outputs_are_up_to_date', async () => {
    const outputs = renderOutputs()
    const docs = await renderDesignDocs()

    expect(Object.keys(outputs)).toEqual([
      'dist/android/MonkiColors.kt',
      'dist/android/MonkiMotion.kt',
      'dist/android/MonkiRadius.kt',
      'dist/android/MonkiSpacing.kt',
      'dist/android/MonkiTypography.kt',
      'dist/macos/MonkiColors.swift',
      'dist/macos/MonkiMotion.swift',
      'dist/macos/MonkiRadius.swift',
      'dist/macos/MonkiSpacing.swift',
      'dist/macos/MonkiTypography.swift',
      'dist/tokens.css',
      'dist/tokens.json',
    ])
    expect(Object.keys(docs)).toEqual(['docs/design/DESIGN.md', 'docs/design/README.md'])

    // Run `npm run build && npm run docs` in packages/design-tokens when this fails.
    for (const [path, content] of Object.entries(outputs)) {
      expect(committed(PACKAGE_ROOT, path), path).toBe(content)
    }
    for (const [path, content] of Object.entries(docs)) {
      expect(committed(REPO_ROOT, path), path).toBe(content)
    }
  })

  it('rendering_is_deterministic', async () => {
    expect(renderOutputs()).toEqual(renderOutputs())
    expect(await renderDesignDocs()).toEqual(await renderDesignDocs())
  })

  it('source_authors_every_colour_in_oklch_without_hex', () => {
    const source = readFileSync(join(PACKAGE_ROOT, 'src/tokens.source.mjs'), 'utf8')

    expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([])
  })
})
