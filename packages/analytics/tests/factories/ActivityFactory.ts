// SPDX-License-Identifier: AGPL-3.0-or-later
/** Synthetic test data builders (no real people, places or browsing). */
import type {
  ActivityEvent,
  AttributedEvent,
  SiteProfile,
  WebTabData,
  WindowData,
} from '@monki-focus/rules'
import type { CategoryAssignment } from '@monki-focus/rules'
import { createRulesCatalog } from '@monki-focus/engine'
import type { RulesCatalog } from '@monki-focus/engine'
import { defaultCategories, siteProfiles, surfaceRegistry } from '@monki-focus/rules/pure'
import type { SyncBlock } from '../../src/index.ts'

/** The bundled rules data, as an adapter builds it from @monki-focus/rules/pure. */
export function bundledCatalog(): RulesCatalog {
  return createRulesCatalog({
    siteProfiles,
    surfaces: surfaceRegistry.surfaces,
    defaultCategories: defaultCategories.assignments,
  })
}

/** A catalog of synthetic site profiles and defaults only. */
export function catalogOf(
  profiles: readonly SiteProfile[] = [],
  defaults: readonly CategoryAssignment[] = []
): RulesCatalog {
  return createRulesCatalog({ siteProfiles: profiles, surfaces: [], defaultCategories: defaults })
}

export function makeWebEvent(
  timestamp: string,
  duration: number,
  data: Partial<WebTabData> = {}
): ActivityEvent {
  return {
    timestamp,
    duration,
    data: {
      domain: 'example.org',
      path: '/',
      surface: null,
      audible: false,
      incognito: false,
      ...data,
    },
  }
}

export function makeWindowEvent(
  timestamp: string,
  duration: number,
  app = 'org.example.Editor',
  title?: string
): ActivityEvent {
  const data: WindowData = { app }
  if (title !== undefined) data.title = title
  return { timestamp, duration, data }
}

export function makeAfkEvent(
  timestamp: string,
  duration: number,
  status: 'afk' | 'not-afk' = 'afk'
): ActivityEvent {
  return { timestamp, duration, data: { status } }
}

export function makeAttributedEvent(overrides: Partial<AttributedEvent> = {}): AttributedEvent {
  return {
    timestamp: '2026-10-26T09:00:00Z',
    duration: 60,
    source: 'web',
    activityKey: 'example.org',
    categoryPath: 'reference',
    level: 75,
    ...overrides,
  }
}

export function makeBlock(overrides: Partial<SyncBlock> = {}): SyncBlock {
  return {
    deviceId: 'device-a',
    blockStart: '2026-10-26T09:00:00Z',
    activityKey: 'example.org',
    categoryPath: 'reference',
    level: 75,
    source: 'web',
    seconds: 60,
    ...overrides,
  }
}

export function makeSiteProfile(
  domain: string,
  surfaces: SiteProfile['surfaces'],
  aliases: string[] = []
): SiteProfile {
  return { schemaVersion: 1, domain, aliases, spaNavigation: 'history', surfaces }
}
