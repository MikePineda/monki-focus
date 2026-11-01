// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The rule set's HTTP validator: its server revision as a strong ETag
 * (`"<revision>"`). Revision 0 means "no rule set stored yet"; the first
 * write goes with `If-Match: "0"`. Revisions fit a Postgres `integer`.
 */
export const NO_RULE_SET_REVISION = 0
export const MAX_RULE_SET_REVISION = 2_147_483_647

const STRONG_TAG = /^"(0|[1-9]\d{0,9})"$/
const ANY_TAG = /^(?:W\/)?"(0|[1-9]\d{0,9})"$/

export function revisionTag(revision: number): string {
  return `"${revision}"`
}

function revisionOf(digits: string): number | null {
  const value = Number(digits)
  return value <= MAX_RULE_SET_REVISION ? value : null
}

/** The revision of one strong ETag (`"7"`); anything else (weak, a list, `*`) is null. */
export function parseRevisionTag(header: string | null | undefined): number | null {
  const match = STRONG_TAG.exec((header ?? '').trim())
  return match ? revisionOf(match[1]) : null
}

/**
 * `If-None-Match` against the current revision (RFC 9110 §13.1.2: weak
 * comparison, a comma-separated list, or `*` when a rule set exists).
 */
export function isNotModified(header: string | null | undefined, current: number): boolean {
  if (header === null || header === undefined) return false
  const tags = header.split(',').map((tag) => tag.trim())
  if (tags.includes('*')) return current !== NO_RULE_SET_REVISION
  return tags.some((tag) => {
    const match = ANY_TAG.exec(tag)
    return match !== null && revisionOf(match[1]) === current
  })
}
