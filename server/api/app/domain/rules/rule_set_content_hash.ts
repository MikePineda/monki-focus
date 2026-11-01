// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { MAX_RULE_SET_DEPTH } from '#domain/rules/rule_set_storable_value'

/**
 * Canonical JSON of a parsed document: object keys sorted by UTF-16 code
 * unit at every depth, no whitespace, scalars as `JSON.stringify` writes
 * them. Two encodings of the same rule set give the same bytes. Nesting
 * deeper than `MAX_RULE_SET_DEPTH` throws `rule_set_too_deep` (callers
 * refuse such documents first, so this never becomes a stack overflow).
 */
export function canonicalJson(value: unknown, depth = 0): string {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    if (depth >= MAX_RULE_SET_DEPTH) throw new RangeError('rule_set_too_deep')
  }
  if (Array.isArray(value))
    return `[${value.map((child) => canonicalJson(child, depth + 1)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child, depth + 1)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** The stored `content_hash`: unpadded base64url SHA-256 of the canonical JSON. */
export function ruleSetContentHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('base64url')
}
