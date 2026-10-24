// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Path globs (SEMANTICS.md §3.2): `/`, or `/`-separated segments that are a
 * literal, `*` (exactly one segment) or a final `**` (zero or more segments).
 * Literals compare ASCII case-insensitively. The schema rejects partial
 * wildcards and `%` escapes, so a glob means exactly what it says.
 */

export interface GlobShape {
  literals: number
  wildcards: number
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

function matchSegments(glob: readonly string[], path: readonly string[]): boolean {
  const [head, ...rest] = glob
  if (head === undefined) return path.length === 0
  if (head === '**') return true
  const [segment, ...remaining] = path
  if (segment === undefined) return false
  if (head !== '*' && asciiLower(head) !== asciiLower(segment)) return false
  return matchSegments(rest, remaining)
}

/** Whether a normalised path (`/`, `/a/b`) matches the glob. */
export function matchesGlob(glob: string, path: string): boolean {
  return matchSegments(segmentsOf(glob), segmentsOf(path))
}

/** Literal segments and wildcards (`*` and `**` count 1 each) of a glob. */
export function globShape(glob: string): GlobShape {
  const segments = segmentsOf(glob)
  const wildcards = segments.filter((segment) => segment === '*' || segment === '**').length
  return { literals: segments.length - wildcards, wildcards }
}

/** `/**` matches every path, also an unknown one. */
export const CATCH_ALL_GLOB = '/**'
