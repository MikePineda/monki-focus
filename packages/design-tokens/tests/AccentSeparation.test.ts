// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { auditAccentSeparation, MIN_ACCENT_DELTA_E } from '../src/checks/AccentSeparationAudit.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'

describe('accent separation', () => {
  it('accent_is_never_a_status_or_level_colour', () => {
    const tokens = resolveTokens()
    const rows = THEMES.flatMap((theme) => auditAccentSeparation(tokens, theme))
    const compared = new Set(rows.map((row) => row.other))

    for (const token of [
      'status-good',
      'status-warning',
      'status-critical',
      'level-0',
      'level-1',
      'level-2',
      'level-3',
      'level-4',
    ]) {
      expect(compared).toContain(token)
    }
    expect(MIN_ACCENT_DELTA_E).toBe(9)
    expect(rows.filter((row) => !row.pass).map((row) => row.label)).toEqual([])
  })

  it('the_amber_alternative_is_flagged_against_status_warning', () => {
    // The draft's reason for recommending teal: amber sits on top of status-warning.
    const rows = THEMES.flatMap((theme) => auditAccentSeparation(resolveTokens('amber'), theme))

    expect(rows.filter((row) => !row.pass).map((row) => row.other)).toEqual([
      'status-warning',
      'status-warning',
    ])
  })
})
