// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResolvedTokens } from '../ResolvedTokens.ts'
import { fontFamilies, radius, spacing, textStyles } from '../tokens.source.mjs'

const px = (value: number): string => `${Number(value.toFixed(2))}px`
const rem = (value: number): string => (value >= 9999 ? '9999px' : `${value / 16}rem`)

/**
 * The YAML front matter of DESIGN.md in Stitch format: the light theme in
 * Material role names, then every semantic token, the type scale, radii and
 * spacing. The dark theme lives in the tables below it.
 */
export function stitchFrontMatter(tokens: ResolvedTokens): string {
  const colors = [
    ...Object.entries(tokens.material.light).map(([role, hex]) => `  ${role}: '${hex}'`),
    ...tokens.colors.map((token) => `  ${token.name}: '${token.light}'`),
  ]
  const typography = textStyles.flatMap((style) => [
    `  ${style.name}:`,
    `    fontFamily: ${fontFamilies.web[0]}`,
    `    fontSize: ${px(style.size)}`,
    `    fontWeight: '${style.weight}'`,
    `    lineHeight: ${px(style.lineHeight)}`,
    `    letterSpacing: ${px(style.size * style.letterSpacingEm)}`,
  ])
  const corners = radius.flatMap((corner) => {
    const key = corner.name.replace(/^radius-/, '')
    const line = `  ${key}: ${rem(corner.px)}`
    return key === 'md' ? [`  DEFAULT: ${rem(corner.px)}`, line] : [line]
  })
  const spaces = [
    '  base: 8px',
    ...spacing.map((space) => `  ${space.name.replace(/^space-/, '')}: ${px(space.px)}`),
  ]
  return [
    '---',
    'name: monki-focus',
    'colors:',
    ...colors,
    'typography:',
    ...typography,
    'rounded:',
    ...corners,
    'spacing:',
    ...spaces,
    '---',
  ].join('\n')
}
