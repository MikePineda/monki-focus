// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { auditMaterial } from '../src/checks/MaterialAudit.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'

describe('Material role contrast', () => {
  it('every_material_on_role_meets_4_5_contrast_in_both_themes', () => {
    const tokens = resolveTokens()
    const rows = THEMES.flatMap((theme) => auditMaterial(tokens, theme))

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.filter((row) => !row.pass).map((row) => row.label)).toEqual([])
  })
})
