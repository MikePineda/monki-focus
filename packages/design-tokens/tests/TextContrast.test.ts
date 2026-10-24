// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { auditContrast } from '../src/checks/ContrastAudit.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'

describe('text contrast', () => {
  it('every_text_token_meets_4_5_contrast_in_both_themes', () => {
    const tokens = resolveTokens()
    const rows = THEMES.flatMap((theme) => auditContrast(tokens, theme)).filter(
      (row) => row.kind === 'text'
    )

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.min).toBe(4.5)
    expect(rows.filter((row) => !row.pass).map((row) => row.label)).toEqual([])
  })

  it('every_ink_step_is_checked_on_every_surface_in_both_themes', () => {
    const tokens = resolveTokens()
    for (const theme of THEMES) {
      const pairs = auditContrast(tokens, theme)
        .filter((row) => row.kind === 'text')
        .map((row) => `${row.fg} on ${row.bg}`)
      for (const ink of ['ink-1', 'ink-2', 'ink-3', 'accent', 'status-critical']) {
        for (const surface of ['surface-0', 'surface-1', 'surface-2']) {
          expect(pairs).toContain(`${ink} on ${surface}`)
        }
      }
      expect(pairs).toContain('accent-ink on accent')
    }
  })
})
