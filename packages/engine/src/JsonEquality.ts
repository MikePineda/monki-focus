// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Structural equality of JSON values (rule-set parts), independent of key
 * order. An `undefined` property counts as absent.
 */

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b)
}
