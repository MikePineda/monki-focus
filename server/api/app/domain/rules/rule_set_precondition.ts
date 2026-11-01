// SPDX-License-Identifier: AGPL-3.0-or-later
import { MAX_RULE_SET_REVISION, parseRevisionTag } from '#domain/rules/rule_set_etag'

export type IfMatchRefusal = 'if_match_required' | 'revision_mismatch' | 'revision_exhausted'

export type IfMatchCheck =
  | { readonly ok: true; readonly next: number }
  | { readonly ok: false; readonly reason: IfMatchRefusal }

/**
 * Optimistic concurrency for a rule set write: the writer names the
 * revision it edited (`If-Match: "<revision>"`, one strong tag). A missing
 * or malformed header and a stale revision are both refused (412), so a
 * device never overwrites a set it has not seen; it re-fetches, merges and
 * retries. A match moves to the next revision.
 */
export function checkIfMatch(header: string | null | undefined, current: number): IfMatchCheck {
  const expected = parseRevisionTag(header)
  if (expected === null) return { ok: false, reason: 'if_match_required' }
  if (expected !== current) return { ok: false, reason: 'revision_mismatch' }
  if (current >= MAX_RULE_SET_REVISION) return { ok: false, reason: 'revision_exhausted' }
  return { ok: true, next: current + 1 }
}
