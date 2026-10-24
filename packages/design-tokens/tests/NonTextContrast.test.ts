// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { auditContrast } from '../src/checks/ContrastAudit.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'

describe('non-text contrast', () => {
  it('focus_border_icon_tokens_meet_3_to_1', () => {
    const tokens = resolveTokens()
    const rows = THEMES.flatMap((theme) => auditContrast(tokens, theme)).filter(
      (row) => row.kind === 'non-text'
    )
    const checked = new Set(rows.map((row) => row.fg))

    for (const token of ['focus', 'line-strong', 'status-good', 'status-warning', 'mark-neutral']) {
      expect(checked).toContain(token)
    }
    for (const row of rows) expect(row.min).toBe(3)
    expect(rows.filter((row) => !row.pass).map((row) => row.label)).toEqual([])
  })
})
