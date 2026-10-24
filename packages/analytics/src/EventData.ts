// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The three ActivityWatch event payloads of SEMANTICS.md §10 and the guards
 * that tell them apart (their required keys never overlap).
 */
import type { ActivityEvent, AfkData, WebTabData, WindowData } from '@monki-focus/rules'

export type EventData = ActivityEvent['data']

export function isWindowData(data: EventData): data is WindowData {
  return 'app' in data
}

export function isAfkData(data: EventData): data is AfkData {
  return 'status' in data
}

export function isWebTabData(data: EventData): data is WebTabData {
  return 'domain' in data
}

/**
 * Deep equality of event data. Payloads are flat by schema (strings,
 * booleans, null), so equal key sets with identical values are deep-equal.
 */
export function sameData(a: EventData, b: EventData): boolean {
  const left = Object.entries(a)
  const right = new Map<string, unknown>(Object.entries(b))
  return (
    left.length === right.size &&
    left.every(([key, value]) => right.has(key) && Object.is(right.get(key), value))
  )
}
