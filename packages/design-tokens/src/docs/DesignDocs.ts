// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { format, resolveConfig } from 'prettier'
import { contrastRatio } from '../color/ContrastRatio.ts'
import { PACKAGE_ROOT, REPO_ROOT } from '../PackagePaths.ts'
import { resolveElevation } from '../ResolvedElevation.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import { resolveTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'
import { ACCENT, fontFamilies } from '../tokens.source.mjs'
import { accentChecksTable, accentValuesTable } from './AccentComparison.ts'
import { stitchFrontMatter } from './StitchFrontMatter.ts'
import {
  lightDarkTable,
  materialTable,
  motionTable,
  scaleTable,
  themeTable,
  typographyTable,
} from './TokenTables.ts'
import {
  contrastDetail,
  materialDetail,
  rampDetail,
  separationDetail,
  validationSummary,
} from './ValidationReport.ts'

const asTheme = (value: string | undefined): Theme => {
  if (value === 'light' || value === 'dark') return value
  throw new Error(`Unknown theme "${value}" in a docs placeholder`)
}

const blocks = (tokens: ResolvedTokens): Record<string, () => string> => ({
  'front-matter': () => stitchFrontMatter(tokens),
  'light-table': () => themeTable(tokens, 'light'),
  'dark-table': () => themeTable(tokens, 'dark'),
  'material-dark-table': () => materialTable(tokens, 'dark'),
  'accent-values': accentValuesTable,
  'accent-checks': accentChecksTable,
  'validation-summary': () => validationSummary(tokens),
  'token-table': () => lightDarkTable(tokens),
  'typography-table': typographyTable,
  'scale-table': scaleTable,
  'motion-table': () => motionTable(tokens),
  'contrast-light': () => contrastDetail(tokens, 'light'),
  'contrast-dark': () => contrastDetail(tokens, 'dark'),
  'material-light': () => materialDetail(tokens, 'light'),
  'material-dark': () => materialDetail(tokens, 'dark'),
  'ramp-detail': () => rampDetail(tokens),
  'separation-detail': () => separationDetail(tokens),
})

const quoteFamily = (family: string): string => (/\s/.test(family) ? `"${family}"` : family)

const inline = (tokens: ResolvedTokens, expression: string): string => {
  const [kind, ...args] = expression.split(':')
  const colour = (theme: Theme, name: string | undefined): string => {
    const value = tokens.color[name ?? '']?.[theme]
    if (!value) throw new Error(`Unknown token in {{${expression}}}`)
    return value
  }
  switch (kind) {
    case 'accent-key':
      return tokens.accentKey
    case 'accent-label':
      return tokens.accentLabel
    case 'accent-label-lower':
      return tokens.accentLabel.toLowerCase()
    case 'font-stack':
      return fontFamilies.web.map(quoteFamily).join(', ')
    case 'hex':
      return colour(asTheme(args[0]), args[1])
    case 'ratio': {
      const theme = asTheme(args[0])
      return `${contrastRatio(colour(theme, args[1]), colour(theme, args[2])).toFixed(2)}:1`
    }
    case 'shadow': {
      const theme = asTheme(args[0])
      const level = resolveElevation(tokens).find((entry) => entry.name === args[1])
      if (!level) throw new Error(`Unknown elevation in {{${expression}}}`)
      return level[theme]
    }
    default:
      throw new Error(`Unknown docs placeholder {{${expression}}}`)
  }
}

/** Fills `<!-- @block -->` lines and `{{inline}}` expressions of one template. */
export function fillTemplate(template: string, tokens: ResolvedTokens): string {
  const available = blocks(tokens)
  return template
    .replace(/^<!-- @([a-z-]+) -->$/gm, (_, name: string) => {
      const render = available[name]
      if (!render) throw new Error(`Unknown docs block "${name}"`)
      return render()
    })
    .replace(/\{\{([a-z0-9:-]+)\}\}/g, (_, expression: string) => inline(tokens, expression))
}

const TEMPLATES: Readonly<Record<string, string>> = {
  'docs/design/DESIGN.md': 'templates/DESIGN.template.md',
  'docs/design/README.md': 'templates/README.template.md',
}

/**
 * docs/design/DESIGN.md and README.md, keyed by their path from the repo root,
 * formatted with the repo's prettier config so `prettier --check` stays green.
 */
export async function renderDesignDocs(
  accentKey: string = ACCENT
): Promise<Record<string, string>> {
  const tokens = resolveTokens(accentKey)
  const entries = await Promise.all(
    Object.entries(TEMPLATES).map(async ([target, template]) => {
      const filled = fillTemplate(readFileSync(join(PACKAGE_ROOT, template), 'utf8'), tokens)
      const filepath = join(REPO_ROOT, target)
      const options = (await resolveConfig(filepath)) ?? {}
      return [target, await format(filled, { ...options, filepath })] as const
    })
  )
  return Object.fromEntries(entries)
}
