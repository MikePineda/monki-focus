// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ActivityWatch export, in the shape aw-server writes for `GET /api/0/export`
 * and reads back on `POST /api/0/import`: `{"buckets": {"<id>": {id, created,
 * type, client, hostname, data, events: [{timestamp, duration, data}]}}}`.
 * Durations are seconds, timestamps RFC 3339 UTC. Event data follows the
 * standard bucket types: `currentwindow` `{app, title}`, `afkstatus`
 * `{status}` and `web.tab.current` `{url, title, audible, incognito}`; web
 * events also keep `domain`, `path` and `surface`, and their `url` is
 * rebuilt from them (never a query or fragment, which are not stored).
 * This is the user's own data leaving through the user's own action.
 */
import type { ActivityEvent, AfkData, WebTabData, WindowData } from '@monki-focus/rules'
import type { EventData } from './EventData.ts'
import { isAfkData, isWebTabData, isWindowData } from './EventData.ts'
import { epochSecondsOf, utcInstantOf } from '@monki-focus/engine'

export type ActivityWatchBucketType = 'currentwindow' | 'afkstatus' | 'web.tab.current'

/** A local bucket and its events, ready to export. */
export interface ActivityWatchBucket {
  id: string
  type: ActivityWatchBucketType
  /** `monki-focus-web`, `monki-focus-mac` or `monki-focus-android`. */
  client: string
  hostname: string
  /** UTC instant the bucket was created. */
  created: string
  events: readonly ActivityEvent[]
}

export type ActivityWatchEventData = Record<string, string | boolean | null>

export interface ActivityWatchEvent {
  timestamp: string
  duration: number
  data: ActivityWatchEventData
}

export interface ActivityWatchExportedBucket {
  id: string
  created: string
  type: ActivityWatchBucketType
  client: string
  hostname: string
  data: Record<string, never>
  events: ActivityWatchEvent[]
}

export interface ActivityWatchExport {
  buckets: Record<string, ActivityWatchExportedBucket>
}

/**
 * Bucket ids follow the aw-watcher convention `<watcher>_<hostname>`. The web
 * bucket names the browser (`monki-web-chrome_<host>`) because the
 * ActivityWatch dashboard pairs web buckets with browser windows by finding
 * the browser name in the bucket id.
 */
export function activityWatchBucketId(
  type: ActivityWatchBucketType,
  hostname: string,
  browser = 'chrome'
): string {
  switch (type) {
    case 'currentwindow':
      return `monki-window_${hostname}`
    case 'afkstatus':
      return `monki-afk_${hostname}`
    case 'web.tab.current':
      return `monki-web-${browser}_${hostname}`
  }
}

function exportedData(type: ActivityWatchBucketType, data: EventData): ActivityWatchEventData {
  if (type === 'currentwindow' && isWindowData(data)) {
    return { app: data.app, title: data.title ?? '' }
  }
  if (type === 'afkstatus' && isAfkData(data)) return { status: data.status }
  if (type === 'web.tab.current' && isWebTabData(data)) {
    return {
      url: `https://${data.domain}${data.path}`,
      title: data.title ?? '',
      audible: data.audible,
      incognito: data.incognito,
      domain: data.domain,
      path: data.path,
      surface: data.surface,
    }
  }
  throw new RangeError(`An event does not fit a ${type} bucket`)
}

export function toActivityWatchExport(
  buckets: readonly ActivityWatchBucket[]
): ActivityWatchExport {
  const exported: Record<string, ActivityWatchExportedBucket> = {}
  for (const bucket of buckets) {
    if (Object.hasOwn(exported, bucket.id)) {
      throw new RangeError(`Duplicate bucket id ${bucket.id}`)
    }
    const events = [...bucket.events]
      .sort((a, b) => epochSecondsOf(a.timestamp) - epochSecondsOf(b.timestamp))
      .map((event) => ({
        timestamp: utcInstantOf(epochSecondsOf(event.timestamp)),
        duration: event.duration,
        data: exportedData(bucket.type, event.data),
      }))
    exported[bucket.id] = {
      id: bucket.id,
      created: utcInstantOf(epochSecondsOf(bucket.created)),
      type: bucket.type,
      client: bucket.client,
      hostname: bucket.hostname,
      data: {},
      events,
    }
  }
  return { buckets: exported }
}

function text(data: ActivityWatchEventData, key: string): string {
  const value = data[key]
  if (typeof value !== 'string') throw new RangeError(`Event data ${key} must be a string`)
  return value
}

function flag(data: ActivityWatchEventData, key: string): boolean {
  const value = data[key]
  if (typeof value !== 'boolean') throw new RangeError(`Event data ${key} must be a boolean`)
  return value
}

function importedData(type: ActivityWatchBucketType, data: ActivityWatchEventData): EventData {
  const title = typeof data.title === 'string' && data.title !== '' ? data.title : null
  switch (type) {
    case 'currentwindow': {
      const window: WindowData = { app: text(data, 'app') }
      if (title !== null) window.title = title
      return window
    }
    case 'afkstatus': {
      const status = text(data, 'status')
      if (status !== 'afk' && status !== 'not-afk') {
        throw new RangeError(`Unknown AFK status ${status}`)
      }
      const afk: AfkData = { status }
      return afk
    }
    case 'web.tab.current': {
      const surface = data.surface === null ? null : text(data, 'surface')
      const web: WebTabData = {
        domain: text(data, 'domain'),
        path: text(data, 'path'),
        surface,
        audible: flag(data, 'audible'),
        incognito: flag(data, 'incognito'),
      }
      if (title !== null) web.title = title
      return web
    }
  }
}

/** aw-server writes microseconds (`…:00.123456+00:00`); instants here are whole seconds. */
const FRACTIONAL_SECONDS = /\.\d+(?=Z$|[+-]\d{2}:\d{2}$)/

function wholeSecondsOf(timestamp: string): string {
  return utcInstantOf(epochSecondsOf(timestamp.replace(FRACTIONAL_SECONDS, '')))
}

/**
 * Reads back an export written by `toActivityWatchExport` (after a JSON
 * round trip): timestamps in UTC `Z` (fractions dropped), durations rounded to
 * whole seconds.
 */
export function fromActivityWatchExport(document: ActivityWatchExport): ActivityWatchBucket[] {
  return Object.values(document.buckets).map((bucket) => ({
    id: bucket.id,
    type: bucket.type,
    client: bucket.client,
    hostname: bucket.hostname,
    created: wholeSecondsOf(bucket.created),
    events: bucket.events.map((event) => ({
      timestamp: wholeSecondsOf(event.timestamp),
      duration: Math.round(event.duration),
      data: importedData(bucket.type, event.data),
    })),
  }))
}
