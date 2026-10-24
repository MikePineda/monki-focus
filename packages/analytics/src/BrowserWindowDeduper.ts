// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser dedupe on one device (SEMANTICS.md §10.8, macOS aggregator). Web
 * events become `web` segments with their domain, never clipped to browser
 * window time; other window events stay `app` segments. Browser window time
 * minus the union of web events is uncovered. The extension's known
 * heartbeats are the end of every web event and `extensionLastHeartbeatAt`;
 * an uncovered instant `t` is `browser-unknown` when the latest heartbeat
 * `h ≤ t` has `t < h + staleAfterSeconds`, otherwise (a silent extension, or
 * no heartbeat yet) it counts as the browser app itself.
 */
import type {
  ActivityEvent,
  ActivitySource,
  AttributedSegment,
  BrowserDedupeGiven,
} from '@monki-focus/rules'
import { epochSecondsOf, utcInstantOf } from '@monki-focus/engine'
import { compareCodeUnits } from './CodeUnitOrder.ts'
import { isWebTabData, isWindowData } from './EventData.ts'
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

/**
 * Splits an uncovered stretch where its latest heartbeat or its staleness
 * changes, labels each part, and joins neighbours with the same label.
 */
function attributeGap(
  gap: Interval,
  app: string,
  heartbeats: readonly number[],
  staleAfterSeconds: number
): Piece[] {
  const cuts = heartbeats
    .flatMap((heartbeat) => [heartbeat, heartbeat + staleAfterSeconds])
    .filter((cut) => cut > gap.start && cut < gap.end)
  const ends = [...new Set([...cuts, gap.end])].sort((a, b) => a - b)
  const pieces: Piece[] = []
  let start = gap.start
  for (const end of ends) {
    // Heartbeats are sorted, so the last one at or before `start` is the latest.
    const latest = heartbeats.filter((heartbeat) => heartbeat <= start).at(-1)
    const live = latest !== undefined && start < latest + staleAfterSeconds
    const activityKey = live ? BROWSER_UNKNOWN : app
    const last = pieces.at(-1)
    if (last?.activityKey === activityKey) last.end = end
    else pieces.push({ start, end, source: 'app', activityKey })
    start = end
  }
  return pieces
}

export function dedupeBrowserTime(input: BrowserDedupeInput): AttributedSegment[] {
  const browsers = new Set(input.browserApps)
  const pieces: Piece[] = input.webEvents.flatMap((event) =>
    isWebTabData(event.data)
      ? [{ ...intervalOf(event), source: 'web' as const, activityKey: event.data.domain }]
      : []
  )
  const covered = [...pieces]
  const lastHeartbeat =
    input.extensionLastHeartbeatAt === null ? [] : [epochSecondsOf(input.extensionLastHeartbeatAt)]
  const heartbeats = [...covered.map((piece) => piece.end), ...lastHeartbeat].sort((a, b) => a - b)

  for (const event of input.windowEvents) {
    if (!isWindowData(event.data)) continue
    const app = event.data.app
    if (!browsers.has(app)) {
      pieces.push({ ...intervalOf(event), source: 'app', activityKey: app })
      continue
    }
    for (const gap of subtractIntervals([intervalOf(event)], covered)) {
      pieces.push(...attributeGap(gap, app, heartbeats, input.staleAfterSeconds))
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
