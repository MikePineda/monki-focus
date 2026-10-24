// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditContrast } from '../src/checks/ContrastAudit.ts'
import { auditMaterial } from '../src/checks/MaterialAudit.ts'
import { renderOutputs } from '../src/GeneratedOutputs.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'
import { writeOutputs } from '../src/WriteOutputs.ts'
import { ACCENT, accents } from '../src/tokens.source.mjs'

const temporaryDirs: string[] = []
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const alternativeAccent = (): string => {
  const other = Object.keys(accents).find((key) => key !== ACCENT)
  if (!other) throw new Error('the source must keep an alternative accent')
  return other
}

describe('accent switch', () => {
  it('switching_accent_source_rebuilds_all_outputs', () => {
    const alternative = alternativeAccent()
    const dir = mkdtempSync(join(tmpdir(), 'monki-design-tokens-'))
    temporaryDirs.push(dir)

    const chosen = resolveTokens(ACCENT)
    const switched = resolveTokens(alternative)
    const files = renderOutputs(alternative)
    writeOutputs(dir, files)

    // Every output file is rebuilt and none keeps an accent-family value of the old accent.
    const oldAccentValues = [
      ...['accent', 'accent-hover', 'accent-soft', 'focus'].flatMap((name) =>
        THEMES.map((theme) => chosen.color[name]?.[theme] ?? '')
      ),
      ...THEMES.flatMap((theme) =>
        ['tertiary-fixed-dim', 'on-tertiary-fixed'].map(
          (role) => chosen.material[theme][role] ?? ''
        )
      ),
    ]
    const defaults = renderOutputs(ACCENT)
    for (const path of Object.keys(defaults)) {
      const written = readFileSync(join(dir, path), 'utf8')
      expect(written, path).toBe(files[path])
      expect(written, path).not.toBe(defaults[path])
      for (const value of oldAccentValues) {
        expect(written.toLowerCase(), `${path} still holds ${value}`).not.toContain(value)
        expect(written, `${path} still holds ${value}`).not.toContain(value.slice(1).toUpperCase())
      }
    }
    const json = JSON.parse(readFileSync(join(dir, 'dist/tokens.json'), 'utf8')) as {
      accent: { chosen: string }
    }
    expect(json.accent.chosen).toBe(alternative)

    // The alternative still clears every contrast floor in both themes.
    const failures = THEMES.flatMap((theme) => [
      ...auditContrast(switched, theme),
      ...auditMaterial(switched, theme),
    ]).filter((row) => !row.pass)
    expect(failures.map((row) => row.label)).toEqual([])
  })
})
