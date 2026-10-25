// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type User from '#models/user'
import BypassEvent from '#models/bypass_event'
import type GuardianLink from '#models/guardian_link'
import { GUARDIAN_EVENT_KINDS } from '#domain/guardians/guardian_event_details'
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
    const windowStart = now.minus({ days: WINDOW_DAYS })
    // Nothing from before this guardian was let in.
    const since =
      link.confirmedAt && link.confirmedAt > windowStart ? link.confirmedAt : windowStart

    const recent = await this.visibleEvents(link, since.toJSDate())
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .limit(RECENT_LIMIT)
    const inWindow = await this.visibleEvents(link, since.toJSDate()).count('* as total')
    const openGaps = await this.visibleEvents(link, since.toJSDate())
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

  /**
   * The ward's events since `since` that are this guardian's to see: every
   * device and dead-man event, but of the guardian-link events only this
   * link's own (`s:<kind>:<link id>` or `s:<kind>:<link id>:...`), never
   * another guardian's.
   */
  protected visibleEvents(link: GuardianLink, since: Date) {
    return ownedBy(BypassEvent, { id: link.wardUserId }, 'ward_user_id')
      .where('occurred_at', '>=', since)
      .where((visible) =>
        visible
          .whereNotIn('kind', [...GUARDIAN_EVENT_KINDS])
          .orWhereRaw(`dedupe_key = 's:' || kind || ':' || ?`, [String(link.id)])
          .orWhereRaw(`dedupe_key LIKE 's:' || kind || ':' || ? || ':%'`, [String(link.id)])
      )
  }
}
