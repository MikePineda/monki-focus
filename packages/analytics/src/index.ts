// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @monki-focus/analytics: the pure analytics core shared by the extension
 * (service worker) and the server (Node). Implements SEMANTICS.md §9–§10 of
 * @monki-focus/rules. No clock, no I/O, no Node-only APIs: every input,
 * including site profiles and default categories, is a parameter.
 */
export type {
  ActivityBlock,
  ActivityEvent,
  ActivitySource,
  AfkData,
  AttributedEvent,
  AttributedSegment,
  CategorisableActivity,
  CategoryAssignment,
  CategoryLevel,
  CategoryMatch,
  DailyTotal,
  LevelledInterval,
  Pulse,
  SecondsByLevel,
  WebTabData,
  WindowData,
} from '@monki-focus/rules'

export { heartbeat, mergeHeartbeats } from './HeartbeatMerger.ts'
export { activeTime } from './AfkFilter.ts'
export type { TabProbeInput } from './TabProbe.ts'
export { probeTab } from './TabProbe.ts'
export { normalizeUrl } from './UrlNormaliser.ts'
export type { CategoriseOptions } from './Categoriser.ts'
export { UNCATEGORISED, categorise } from './Categoriser.ts'
export type { PulseInput } from './PulseCalculator.ts'
export { pulse } from './PulseCalculator.ts'
export type { BlockOptions } from './BlockAggregator.ts'
export { toBlocks } from './BlockAggregator.ts'
export { dailyTotals } from './DailyTotals.ts'
export { localDateOf, nextLocalMidnight } from './LocalCalendar.ts'
export type { BrowserDedupeInput } from './BrowserWindowDeduper.ts'
export { BROWSER_UNKNOWN, dedupeBrowserTime } from './BrowserWindowDeduper.ts'
export type { Interval } from './IntervalSet.ts'
export { subtractIntervals, unionIntervals } from './IntervalSet.ts'
export { capAcrossDevices } from './CrossDeviceCapper.ts'
export { scaleToCap } from './LargestRemainder.ts'
export type { SyncBlock } from './SyncBlock.ts'
export { BLOCK_SECONDS, SYNC_BLOCK_FIELDS, compareSyncBlocks, toSyncBlock } from './SyncBlock.ts'
export type {
  ActivityWatchBucket,
  ActivityWatchBucketType,
  ActivityWatchEvent,
  ActivityWatchEventData,
  ActivityWatchExport,
  ActivityWatchExportedBucket,
} from './ActivityWatchExport.ts'
export {
  activityWatchBucketId,
  fromActivityWatchExport,
  toActivityWatchExport,
} from './ActivityWatchExport.ts'
