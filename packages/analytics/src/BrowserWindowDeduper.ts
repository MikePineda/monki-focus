// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser dedupe on one device (SEMANTICS.md §10.8, macOS aggregator). Web
 * events become `web` segments with their domain; other window events stay
 * `app` segments. Browser window time minus the union of web events is
 * uncovered: up to `extensionLastHeartbeatAt + staleAfterSeconds` it is
 * `browser-unknown` (neutral), later (a silent extension) it counts as the
 * browser app itself.
 */
import type {
  ActivityEvent,
  ActivitySource,
  AttributedSegment,
  BrowserDedupeGiven,
} from '@monki-focus/rules'
import { compareCodeUnits } from './CodeUnitOrder.ts'
import { isWebTabData, isWindowData } from './EventData.ts'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'
import type { Interval } from './IntervalSet.ts'
import { subtractIntervals } from './IntervalSet.ts'

export type BrowserDedupeInput = BrowserDedupeGiven

/** Activity key of browser time the live extension did not explain. */
export const BROWSER_UNKNOWN = 'browser-unknown'

interface Piece extends Interval {
  source: ActivitySource
  activityKey: string
}

function intervalOf(event: ActivityEvent): Interval {
  const start = epochSecondsOf(event.timestamp)
  return { start, end: start + event.duration }
}

function comparePieces(a: Piece, b: Piece): number {
  return (
    a.start - b.start ||
    a.end - b.end ||
    compareCodeUnits(a.source, b.source) ||
    compareCodeUnits(a.activityKey, b.activityKey)
  )
}

export function dedupeBrowserTime(input: BrowserDedupeInput): AttributedSegment[] {
  const browsers = new Set(input.browserApps)
  const pieces: Piece[] = input.webEvents.flatMap((event) =>
    isWebTabData(event.data)
      ? [{ ...intervalOf(event), source: 'web' as const, activityKey: event.data.domain }]
      : []
  )
  const covered = [...pieces]
  const staleAt =
    input.extensionLastHeartbeatAt === null
      ? Number.NEGATIVE_INFINITY
      : epochSecondsOf(input.extensionLastHeartbeatAt) + input.staleAfterSeconds

  for (const event of input.windowEvents) {
    if (!isWindowData(event.data)) continue
    const app = event.data.app
    if (!browsers.has(app)) {
      pieces.push({ ...intervalOf(event), source: 'app', activityKey: app })
      continue
    }
    for (const gap of subtractIntervals([intervalOf(event)], covered)) {
      const split = Math.min(Math.max(gap.start, staleAt), gap.end)
      pieces.push({ start: gap.start, end: split, source: 'app', activityKey: BROWSER_UNKNOWN })
      pieces.push({ start: split, end: gap.end, source: 'app', activityKey: app })
    }
  }
  return pieces
    .filter((piece) => piece.end > piece.start)
    .sort(comparePieces)
    .map((piece) => ({
      start: utcInstantOf(piece.start),
      end: utcInstantOf(piece.end),
      source: piece.source,
      activityKey: piece.activityKey,
    }))
}
