// SPDX-License-Identifier: AGPL-3.0-or-later
import { contrastRatio } from '../color/ContrastRatio.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'
import type { ContrastKind } from './ContrastRules.ts'
import { CONTRAST_RULES, MIN_CONTRAST } from './ContrastRules.ts'

export interface ContrastRow {
  readonly theme: Theme
  readonly fg: string
  readonly bg: string
  readonly fgHex: string
  readonly bgHex: string
  readonly ratio: number
  readonly min: number | null
  readonly kind: ContrastKind
  readonly purpose: string
  readonly pass: boolean
  /** One readable line for test failures and reports. */
  readonly label: string
}

const hexOf = (tokens: ResolvedTokens, name: string, theme: Theme): string => {
  const token = tokens.color[name]
  if (!token) throw new Error(`Contrast rule names an unknown token "${name}"`)
  return token[theme]
}

/** Evaluates every contrast rule for one theme, in rule order. */
export function auditContrast(tokens: ResolvedTokens, theme: Theme): ContrastRow[] {
  return CONTRAST_RULES.flatMap((rule) =>
    rule.on.map((bg): ContrastRow => {
      const fgHex = hexOf(tokens, rule.fg, theme)
      const bgHex = hexOf(tokens, bg, theme)
      const ratio = contrastRatio(fgHex, bgHex)
      const min = MIN_CONTRAST[rule.kind]
      const pass = min === null || ratio >= min
      return {
        theme,
        fg: rule.fg,
        bg,
        fgHex,
        bgHex,
        ratio,
        min,
        kind: rule.kind,
        purpose: rule.purpose,
        pass,
        label: `${tokens.accentKey}/${theme}: ${rule.fg} ${fgHex} on ${bg} ${bgHex} = ${ratio.toFixed(2)}:1 (min ${min ?? '-'})`,
      }
    })
  )
}
