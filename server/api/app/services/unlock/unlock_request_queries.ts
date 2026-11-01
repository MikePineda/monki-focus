// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type User from '#models/user'
import UnlockRequest from '#models/unlock_request'
import { scopeTarget } from '#domain/unlock/unlock_scope'
import { effectiveStatus } from '#domain/unlock/unlock_request_state'

export const HISTORY_PAGE_SIZE = 20

/**
 * The dashboard's reads of unlock requests:
 *
 * - the ward's own history (everything they asked, newest first);
 * - a guardian's requests, only through links that grant guardianship
 *   right now (a revoking link shows only its pending, unexpired ones) and only while the guardian has two-step verification on
 *   (anything else lists nothing). A guardian sees the host or the app,
 *   never a path, plus the reason the ward wrote for them.
 */
export default class UnlockRequestQueries {
  async historyOf(ward: User, page: number, now: DateTime) {
    const result = await UnlockRequest.query()
      .where('ward_user_id', ward.id)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, HISTORY_PAGE_SIZE)
    return {
      data: result.all().map((request) => ({
        uuid: request.uuid,
        status: effectiveStatus(request.timeline(), now.toJSDate()),
        ruleId: request.ruleId,
        scope: request.scope,
        requestedMinutes: request.requestedMinutes,
        grantedMinutes: request.grantedMinutes,
        reason: request.reason,
        decidedVia: request.decidedVia,
        decidedAt: request.decidedAt?.toISO() ?? null,
        createdAt: request.createdAt.toISO(),
        expiresAt: request.expiresAt.toISO(),
      })),
      meta: { page: result.currentPage, perPage: HISTORY_PAGE_SIZE, total: result.total },
    }
  }

  async forGuardian(guardian: User, onlyPending: boolean, now: DateTime) {
    if (!guardian.twoFactorEnabled) return []
    const at = now.toJSDate()
    // Active links show the history; a revoking link (the ward asked to
    // leave) only what the guardian still decides: pending, unexpired.
    const query = UnlockRequest.query()
      .where((visible) =>
        visible
          .whereIn('guardian_link_id', (links) =>
            links
              .from('guardian_links')
              .select('id')
              .where('guardian_user_id', guardian.id)
              .where('status', 'active')
              .whereNull('revocation_effective_at')
          )
          .orWhere((deciding) =>
            deciding
              .whereIn('guardian_link_id', (links) =>
                links
                  .from('guardian_links')
                  .select('id')
                  .where('guardian_user_id', guardian.id)
                  .where('status', 'active')
                  .where('revocation_effective_at', '>', at)
              )
              .where('status', 'pending')
              .where('expires_at', '>', at)
          )
      )
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(100)
    if (onlyPending) query.where('status', 'pending').where('expires_at', '>', at)
    const requests = await query
    return requests.map((request) => ({
      uuid: request.uuid,
      linkId: request.guardianLinkId,
      status: effectiveStatus(request.timeline(), at),
      scope: scopeTarget(request.scope),
      requestedMinutes: request.requestedMinutes,
      grantedMinutes: request.grantedMinutes,
      reason: request.reason,
      decidedVia: request.decidedVia,
      decidedAt: request.decidedAt?.toISO() ?? null,
      createdAt: request.createdAt.toISO(),
      expiresAt: request.expiresAt.toISO(),
    }))
  }
}
