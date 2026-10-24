// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Code-unit (ASCII) string order of SEMANTICS.md §1, identical on every
 * platform (never locale order).
 */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Code-unit order where `null` sorts before every string. */
export function compareNullableCodeUnits(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return compareCodeUnits(a, b)
}
