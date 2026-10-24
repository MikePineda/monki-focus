// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Path globs of SEMANTICS.md §3.2: `/`-separated literals, `*` (exactly one
 * segment) and a final `**` (zero or more). Literals compare ASCII
 * case-insensitively.
 */

const WILDCARDS = new Set(['*', '**'])

/** Non-empty segments of a path or glob (`/` has none). */
export function segmentsOf(pathOrGlob: string): string[] {
  return pathOrGlob.split('/').filter((segment) => segment !== '')
}

function asciiLowerCase(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

function segmentMatches(globSegment: string, pathSegment: string): boolean {
  return globSegment === '*' || asciiLowerCase(globSegment) === asciiLowerCase(pathSegment)
}

export function matchesGlob(glob: string, path: string): boolean {
  const globSegments = segmentsOf(glob)
  const pathSegments = segmentsOf(path)
  const open = globSegments.at(-1) === '**'
  const fixed = open ? globSegments.slice(0, -1) : globSegments
  const lengthFits = open
    ? pathSegments.length >= fixed.length
    : pathSegments.length === fixed.length
  return (
    lengthFits &&
    fixed.every((segment, index) => {
      const pathSegment = pathSegments[index]
      return pathSegment !== undefined && segmentMatches(segment, pathSegment)
    })
  )
}

/** Literal (non-wildcard) segments, ranked by §4 step 2. */
export function literalSegmentCount(glob: string): number {
  return segmentsOf(glob).filter((segment) => !WILDCARDS.has(segment)).length
}

/** `*` and `**` segments, ranked by §4 step 4 (fewer wins). */
export function wildcardCount(glob: string): number {
  return segmentsOf(glob).filter((segment) => WILDCARDS.has(segment)).length
}
