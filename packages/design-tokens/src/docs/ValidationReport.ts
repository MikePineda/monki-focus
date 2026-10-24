// SPDX-License-Identifier: AGPL-3.0-or-later
import { auditAccentSeparation, MIN_ACCENT_DELTA_E } from '../checks/AccentSeparationAudit.ts'
import { auditContrast } from '../checks/ContrastAudit.ts'
import { auditLevelRamp, LEVEL_RAMP_SURFACES } from '../checks/LevelRampAudit.ts'
import { auditMaterial } from '../checks/MaterialAudit.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'
import { THEMES } from '../Theme.ts'
import { code, markdownTable } from './MarkdownTable.ts'

const verdict = (pass: boolean, reportOnly = false): string =>
  reportOnly ? 'INFO' : pass ? 'PASS' : 'FAIL'

const count = (rows: readonly { pass: boolean }[]): string => {
  const failed = rows.filter((row) => !row.pass).length
  return failed === 0 ? `PASS (${rows.length})` : `FAIL (${failed} of ${rows.length})`
}

/** One line per check and theme, with the test that enforces it. */
export const validationSummary = (tokens: ResolvedTokens): string => {
  const perTheme = (theme: Theme) => {
    const contrast = auditContrast(tokens, theme)
    return {
      text: contrast.filter((row) => row.kind === 'text'),
      nonText: contrast.filter((row) => row.kind === 'non-text'),
      ordinal: contrast.filter((row) => row.kind === 'ordinal'),
      ramp: LEVEL_RAMP_SURFACES.flatMap((surface) => auditLevelRamp(tokens, theme, surface)),
      separation: auditAccentSeparation(tokens, theme),
      material: auditMaterial(tokens, theme),
    }
  }
  const [light, dark] = THEMES.map(perTheme) as [
    ReturnType<typeof perTheme>,
    ReturnType<typeof perTheme>,
  ]
  const row = (
    check: string,
    test: string,
    pick: (r: ReturnType<typeof perTheme>) => readonly { pass: boolean }[]
  ): string[] => [check, code(test), count(pick(light)), count(pick(dark))]
  return markdownTable(
    ['Check', 'Test', 'Light', 'Dark'],
    [
      row('Text ≥ 4.5:1', 'every_text_token_meets_4_5_contrast_in_both_themes', (r) => r.text),
      row(
        'Focus ring, boundaries, icons, marks ≥ 3:1',
        'focus_border_icon_tokens_meet_3_to_1',
        (r) => r.nonText
      ),
      row(
        'Level ramp: monotone, ΔL ≥ 0.06, end ≥ 2:1, one hue',
        'level_ramp_is_monotonic_and_distinguishable_in_both_themes',
        (r) => [...r.ramp, ...r.ordinal]
      ),
      row(
        `Accent vs status and level ΔE ≥ ${MIN_ACCENT_DELTA_E}`,
        'accent_is_never_a_status_or_level_colour',
        (r) => r.separation
      ),
      row(
        'Material on-X / X ≥ 4.5:1',
        'every_material_on_role_meets_4_5_contrast_in_both_themes',
        (r) => r.material
      ),
    ]
  )
}

/** Every WCAG pair of one theme. */
export const contrastDetail = (tokens: ResolvedTokens, theme: Theme): string =>
  markdownTable(
    ['Token', 'On', 'Ratio', 'Min', 'Kind', 'Result'],
    auditContrast(tokens, theme).map((row) => [
      `${code(row.fg)} ${code(row.fgHex)}`,
      `${code(row.bg)} ${code(row.bgHex)}`,
      row.ratio.toFixed(2),
      row.min === null ? '-' : `${row.min}`,
      `${row.kind} (${row.purpose})`,
      verdict(row.pass, row.min === null),
    ])
  )

/** Every Material text pair of one theme. */
export const materialDetail = (tokens: ResolvedTokens, theme: Theme): string =>
  markdownTable(
    ['Text role', 'On role', 'Ratio', 'Result'],
    auditMaterial(tokens, theme).map((row) => [
      `${row.fg} ${code(row.fgHex)}`,
      `${row.bg} ${code(row.bgHex)}`,
      row.ratio.toFixed(2),
      verdict(row.pass),
    ])
  )

/** The four ramp checks per theme and surface. */
export const rampDetail = (tokens: ResolvedTokens): string =>
  markdownTable(
    ['Theme', 'Surface', 'Check', 'Detail', 'Result'],
    THEMES.flatMap((theme) =>
      LEVEL_RAMP_SURFACES.flatMap((surface) =>
        auditLevelRamp(tokens, theme, surface).map((check) => [
          theme,
          code(surface),
          check.check,
          check.detail,
          verdict(check.pass),
        ])
      )
    )
  )

/** OKLab ΔE between the accent and every status and level colour. */
export const separationDetail = (tokens: ResolvedTokens): string =>
  markdownTable(
    ['Theme', 'Accent', 'Versus', 'ΔE', 'Result'],
    THEMES.flatMap((theme) =>
      auditAccentSeparation(tokens, theme).map((row) => [
        theme,
        code(row.accentHex),
        `${code(row.other)} ${code(row.otherHex)}`,
        row.deltaE.toFixed(1),
        verdict(row.pass),
      ])
    )
  )
