// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { auditContrast } from '../src/checks/ContrastAudit.ts'
import { auditLevelRamp, LEVEL_RAMP_SURFACES } from '../src/checks/LevelRampAudit.ts'
import { resolveTokens } from '../src/ResolvedTokens.ts'
import { THEMES } from '../src/Theme.ts'

describe('focus-level ramp', () => {
  it('level_ramp_is_monotonic_and_distinguishable_in_both_themes', () => {
    const tokens = resolveTokens()
    const checks = THEMES.flatMap((theme) =>
      LEVEL_RAMP_SURFACES.flatMap((surface) => auditLevelRamp(tokens, theme, surface))
    )
    const names = new Set(checks.map((check) => check.check))

    expect(names).toEqual(
      new Set(['lightness-monotone', 'adjacent-delta-l', 'end-contrast', 'single-hue'])
    )
    expect(checks).toHaveLength(THEMES.length * LEVEL_RAMP_SURFACES.length * names.size)
    expect(checks.filter((check) => !check.pass).map((check) => check.label)).toEqual([])

    // Every step, not only the one nearest the surface, clears 2:1 (legend + table relief).
    const steps = THEMES.flatMap((theme) => auditContrast(tokens, theme)).filter(
      (row) => row.kind === 'ordinal'
    )
    expect(steps).toHaveLength(THEMES.length * LEVEL_RAMP_SURFACES.length * 5)
    expect(steps.filter((row) => !row.pass).map((row) => row.label)).toEqual([])
  })

  it('level_ramp_audit_rejects_a_ramp_that_steps_backwards', () => {
    const tokens = resolveTokens()
    const level1 = tokens.color['level-1']
    const level3 = tokens.color['level-3']
    if (!level1 || !level3) throw new Error('level tokens missing')
    const swapped = {
      ...tokens,
      color: {
        ...tokens.color,
        'level-1': { ...level1, light: level3.light },
        'level-3': { ...level3, light: level1.light },
      },
    }

    const failed = auditLevelRamp(swapped, 'light', 'surface-0').filter((check) => !check.pass)

    expect(failed.map((check) => check.check)).toContain('lightness-monotone')
  })
})
