// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolveElevation } from '../ResolvedElevation.ts'
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import type { Theme } from '../Theme.ts'
import { durations, easings, fontFamilies, radius, spacing, textStyles } from '../tokens.source.mjs'
import { SPDX, generatedNotice } from './GeneratedNotice.ts'
import { cssVariableName } from './TokenNames.ts'

const quoteFamily = (family: string): string => (/\s/.test(family) ? `'${family}'` : family)
const em = (value: number): string => (value === 0 ? '0' : `${value}em`)

const themeDeclarations = (tokens: ResolvedTokens, theme: Theme, indent: string): string[] => {
  const elevations = resolveElevation(tokens)
  return [
    `color-scheme: ${theme};`,
    ...tokens.colors.map((token) => `${cssVariableName(token.name)}: ${token[theme]};`),
    ...elevations.map((level) => `${cssVariableName(level.name)}: ${level[theme]};`),
  ].map((line) => indent + line)
}

const scaleDeclarations = (): string[] => [
  `${cssVariableName('font-family-sans')}: ${fontFamilies.web.map(quoteFamily).join(', ')};`,
  ...textStyles.flatMap((style) => [
    `${cssVariableName(`type-${style.name}-size`)}: ${style.size}px;`,
    `${cssVariableName(`type-${style.name}-line-height`)}: ${style.lineHeight}px;`,
    `${cssVariableName(`type-${style.name}-weight`)}: ${style.weight};`,
    `${cssVariableName(`type-${style.name}-letter-spacing`)}: ${em(style.letterSpacingEm)};`,
    `${cssVariableName(`type-${style.name}-numeric`)}: ${style.tabular ? 'tabular-nums' : 'normal'};`,
  ]),
  ...spacing.map((space) => `${cssVariableName(space.name)}: ${space.px}px;`),
  ...radius.map((corner) => `${cssVariableName(corner.name)}: ${corner.px}px;`),
  ...durations.map((duration) => `${cssVariableName(duration.name)}: ${duration.ms}ms;`),
  ...easings.map(
    (easing) =>
      `${cssVariableName(easing.name)}: cubic-bezier(${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2});`
  ),
]

/**
 * `dist/tokens.css`. Light values are the defaults on `:root` and `:host` (the
 * extension's shadow roots). Dark values apply under `prefers-color-scheme:
 * dark` unless `data-theme="light"` is set, and always under
 * `data-theme="dark"`. Theme-independent scales follow.
 */
export function renderCss(tokens: ResolvedTokens): string {
  const lines = [
    `/* ${SPDX} */`,
    `/* ${generatedNotice(tokens.accentKey)} */`,
    '',
    ':root,',
    ':host,',
    "[data-theme='light'] {",
    ...themeDeclarations(tokens, 'light', '  '),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']),",
    "  :host(:not([data-theme='light'])) {",
    ...themeDeclarations(tokens, 'dark', '    '),
    '  }',
    '}',
    '',
    "[data-theme='dark'],",
    ":host([data-theme='dark']) {",
    ...themeDeclarations(tokens, 'dark', '  '),
    '}',
    '',
    ':root,',
    ':host {',
    ...scaleDeclarations().map((line) => '  ' + line),
    '}',
  ]
  return lines.join('\n') + '\n'
}
