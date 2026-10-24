// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent, SyncBlock, WebTabData } from '@monki-focus/analytics'

/** A synthetic web event on a reserved `.example` host unless overridden. */
export function makeEvent(
  overrides: Partial<Omit<ActivityEvent, 'data'>> & { data?: Partial<WebTabData> } = {}
): ActivityEvent {
  const { data, ...event } = overrides
  return {
    timestamp: '2026-01-05T09:00:00Z',
    duration: 60,
    ...event,
    data: {
      domain: 'news.example',
      path: '/',
      surface: null,
      audible: false,
      incognito: false,
      ...data,
    },
  }
}

/** A synthetic 5-minute block. */
export function makeBlock(overrides: Partial<SyncBlock> = {}): SyncBlock {
  return {
    deviceId: 'device-a',
    blockStart: '2026-01-05T09:00:00Z',
    activityKey: 'news.example',
    categoryPath: 'news',
    level: 50,
    source: 'web',
    seconds: 120,
    ...overrides,
  }
}
