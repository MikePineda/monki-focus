// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GateHandoff } from '../shared/messages'

/**
 * The DNR redirect lands on `gate.html?t=<ticket>&to=<original URL>` (the
 * URL verbatim, so it is everything after `&to=`). The page only forwards
 * the pair to the service worker, which accepts it with this session's
 * ticket alone; the page itself never navigates to `to`. Anything else in
 * the query is no hand-off.
 */
const HANDOFF = /^\?t=([a-z]{32})&to=(https?:\/\/.+)$/

export function parseHandoff(search: string): GateHandoff | null {
  const match = HANDOFF.exec(search)
  if (!match) return null
  const [, ticket = '', to = ''] = match
  return { ticket, to }
}
