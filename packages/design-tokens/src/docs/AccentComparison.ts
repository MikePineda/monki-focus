// SPDX-License-Identifier: AGPL-3.0-or-later
import { auditAccentSeparation, MIN_ACCENT_DELTA_E } from '../checks/AccentSeparationAudit.ts'
import { auditContrast } from '../checks/ContrastAudit.ts'
import { auditMaterial } from '../checks/MaterialAudit.ts'
import { contrastRatio } from '../color/ContrastRatio.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import { resolveTokens } from '../ResolvedTokens.ts'
import { THEMES } from '../Theme.ts'
import { ACCENT, RECOMMENDED_ACCENT, accents } from '../tokens.source.mjs'
import { code, markdownTable } from './MarkdownTable.ts'

const ACCENT_ROLES = ['accent', 'accent-hover', 'accent-ink', 'accent-soft'] as const
const SURFACES = ['surface-0', 'surface-1', 'surface-2'] as const

const options = (): ResolvedTokens[] => Object.keys(accents).map((key) => resolveTokens(key))

const optionName = (tokens: ResolvedTokens): string => {
  const marks = [
    tokens.accentKey === ACCENT ? 'active' : null,
    tokens.accentKey === RECOMMENDED_ACCENT ? 'recommended' : null,
  ].filter(Boolean)
  return `${tokens.accentLabel} (${code(tokens.accentKey)}${marks.length ? ', ' + marks.join(', ') : ''})`
}

const hex = (tokens: ResolvedTokens, name: string, theme: 'light' | 'dark'): string =>
  tokens.color[name]?.[theme] ?? '?'

/** The accent-family values of every option, side by side. */
export const accentValuesTable = (): string => {
  const all = options()
  return markdownTable(
    ['Token', ...all.flatMap((o) => THEMES.map((theme) => `${o.accentLabel} ${theme}`))],
    ACCENT_ROLES.map((role) => [
      code(role),
      ...all.flatMap((o) => THEMES.map((theme) => code(hex(o, role, theme)))),
    ])
  )
}

/** Key contrast figures, the closest status/level colour and the overall verdict per option. */
export const accentChecksTable = (): string =>
  markdownTable(
    [
      'Option',
      'Theme',
      '`accent` on worst surface',
      '`accent-ink` on `accent`',
      '`accent` on `accent-soft`',
      'Closest status/level (ΔE)',
      'Contrast rules',
      `Separation (ΔE ≥ ${MIN_ACCENT_DELTA_E})`,
    ],
    options().flatMap((o) =>
      THEMES.map((theme) => {
        const accentHex = hex(o, 'accent', theme)
        const worst = Math.min(
          ...SURFACES.map((surface) => contrastRatio(accentHex, hex(o, surface, theme)))
        )
        const closest = [...auditAccentSeparation(o, theme)].sort((a, b) => a.deltaE - b.deltaE)[0]
        const contrastPass = [...auditContrast(o, theme), ...auditMaterial(o, theme)].every(
          (row) => row.pass
        )
        return [
          optionName(o),
          theme,
          `${worst.toFixed(2)}:1`,
          `${contrastRatio(hex(o, 'accent-ink', theme), accentHex).toFixed(2)}:1`,
          `${contrastRatio(accentHex, hex(o, 'accent-soft', theme)).toFixed(2)}:1`,
          closest ? `${code(closest.other)} ${closest.deltaE.toFixed(1)}` : '-',
          contrastPass ? 'PASS' : 'FAIL',
          closest && closest.pass ? 'PASS' : 'FAIL',
        ]
      })
    )
  )
