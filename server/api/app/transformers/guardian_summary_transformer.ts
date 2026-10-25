// SPDX-License-Identifier: AGPL-3.0-or-later
import { BYPASS_DETAIL_RULES } from '#domain/devices/bypass_event_details'
import { GUARDIAN_EVENT_DETAIL_RULES } from '#domain/guardians/guardian_event_details'

/**
 * What a guardian sees of their ward: the documented DTO and nothing else
 * (anti-stalkerware rule, SECURITY.md). Score (today and the last 7 days),
 * unlock counts and bypass events; never a URL, a title, a domain, an app,
 * a device name or id, a dedupe key or free text. Built field by field
 * from an allowlist, so whatever extra a caller hands in (a model with
 * more columns, a hostile `details` blob) cannot reach the response.
 *
 * Bypass `details` are filtered a second time here: only keys some kind's
 * allowlist knows, each a boolean, a safe integer or a short code
 * (`[A-Za-z0-9_:-]`, so no dot, slash, space or `@`: no domain, path,
 * sentence or address fits).
 */

export interface GuardianSummaryEvent {
  readonly id: number
  readonly kind: string
  readonly source: string
  readonly details: unknown
  readonly occurredAt: Date
  readonly resolvedAt: Date | null
  readonly acknowledgedAt: Date | null
}

export interface GuardianSummaryInput {
  readonly wardUserId: number
  readonly generatedAt: Date
  /** Focus score 0-100 in the ward's time zone; null until activity sync exists (phase 4). */
  readonly score: { readonly today: number | null; readonly last7Days: number | null }
  /** Unlock requests of the last 7 days (S6 adds them; 0 until then). */
  readonly unlocks: {
    readonly requested: number
    readonly approved: number
    readonly denied: number
  }
  readonly bypasses: {
    readonly last7Days: number
    /** Dead-man gaps (`heartbeat_missing`) still open, whenever they started. */
    readonly openGaps: number
    readonly recent: readonly GuardianSummaryEvent[]
  }
}

/** Detail keys the server itself writes (S4: dead-man, enrolment, key pins, thresholds). */
const SERVER_DETAIL_KEYS = [
  'announced',
  'gapSeconds',
  'fromHours',
  'toHours',
  'platform',
  'unknownUnlockKids',
  'unknownPolicyKids',
]

const VISIBLE_DETAIL_KEYS: ReadonlySet<string> = new Set([
  ...SERVER_DETAIL_KEYS,
  ...Object.values(BYPASS_DETAIL_RULES).flatMap((rules) => Object.keys(rules)),
  ...Object.values(GUARDIAN_EVENT_DETAIL_RULES).flatMap((rules) => Object.keys(rules)),
])

const CODE_VALUE = /^[A-Za-z0-9_:-]{1,64}$/

function visibleDetails(details: unknown): Record<string, string | number | boolean> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  const visible: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (!VISIBLE_DETAIL_KEYS.has(key)) continue
    if (typeof value === 'boolean' || Number.isSafeInteger(value)) {
      visible[key] = value as boolean | number
    } else if (typeof value === 'string' && CODE_VALUE.test(value)) {
      visible[key] = value
    }
  }
  return visible
}

const iso = (date: Date | null) => date?.toISOString() ?? null

function score(value: number | null) {
  return Number.isFinite(value) ? Math.round(value as number) : null
}

export function guardianSummaryResource(input: GuardianSummaryInput) {
  return {
    wardUserId: input.wardUserId,
    generatedAt: input.generatedAt.toISOString(),
    score: { today: score(input.score.today), last7Days: score(input.score.last7Days) },
    unlocks: {
      last7Days: {
        requested: input.unlocks.requested,
        approved: input.unlocks.approved,
        denied: input.unlocks.denied,
      },
    },
    bypasses: {
      last7Days: input.bypasses.last7Days,
      openGaps: input.bypasses.openGaps,
      recent: input.bypasses.recent.map((event) => ({
        id: event.id,
        kind: event.kind,
        source: event.source,
        details: visibleDetails(event.details),
        occurredAt: event.occurredAt.toISOString(),
        resolvedAt: iso(event.resolvedAt),
        acknowledgedAt: iso(event.acknowledgedAt),
      })),
    },
  }
}
