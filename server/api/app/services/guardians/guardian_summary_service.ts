// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type User from '#models/user'
import BypassEvent from '#models/bypass_event'
import { ownedBy } from '#services/tenancy/owned_by'
import Guardianship from '#services/guardians/guardianship'
import { guardianSummaryResource } from '#transformers/guardian_summary_transformer'

/** Bypass events listed in a summary, newest first. */
const RECENT_LIMIT = 50

/** The window of the summary's counts and list. */
const WINDOW_DAYS = 7

/**
 * `GET /guardian/wards/:wardUserId/summary`: what the guardian sees, read
 * only after the guardianship check (an active link, the guardian's
 * second factor on; anything else is a 404) and handed to the allowlist
 * transformer. Score: null until activity sync exists (phase 4); unlock
 * counts: 0 until unlock requests exist (S6).
 */
@inject()
export default class GuardianSummaryService {
  constructor(protected guardianship: Guardianship) {}

  async build(guardian: User, wardUserId: number, now: DateTime) {
    const link = await this.guardianship.activeLinkOrFail(guardian, wardUserId, now)
    const ward = { id: link.wardUserId }
    const since = now.minus({ days: WINDOW_DAYS }).toJSDate()

    const recent = await ownedBy(BypassEvent, ward, 'ward_user_id')
      .where('occurred_at', '>=', since)
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .limit(RECENT_LIMIT)
    const inWindow = await ownedBy(BypassEvent, ward, 'ward_user_id')
      .where('occurred_at', '>=', since)
      .count('* as total')
    const openGaps = await ownedBy(BypassEvent, ward, 'ward_user_id')
      .where('kind', 'heartbeat_missing')
      .whereNull('resolved_at')
      .count('* as total')

    return guardianSummaryResource({
      wardUserId: link.wardUserId,
      generatedAt: now.toJSDate(),
      score: { today: null, last7Days: null },
      unlocks: { requested: 0, approved: 0, denied: 0 },
      bypasses: {
        last7Days: Number(inWindow[0].$extras.total),
        openGaps: Number(openGaps[0].$extras.total),
        recent: recent.map((event) => ({
          id: event.id,
          kind: event.kind,
          source: event.source,
          details: event.details,
          occurredAt: event.occurredAt.toJSDate(),
          resolvedAt: event.resolvedAt?.toJSDate() ?? null,
          acknowledgedAt: event.acknowledgedAt?.toJSDate() ?? null,
        })),
      },
    })
  }
}
