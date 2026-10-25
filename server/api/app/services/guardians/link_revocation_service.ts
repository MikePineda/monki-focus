// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import {
  PENDING_LINK_TTL_HOURS,
  grantsGuardianship,
  type LinkRole,
} from '#domain/guardians/link_state'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { lockUserRows } from '#services/database/user_row_locks'
import { retryOnDeadlock } from '#services/database/deadlock_retry'
import {
  canCancelRevocation,
  planRevocation,
  wardRevocationCooldownHours,
} from '#domain/guardians/link_revocation'
import GuardianNotices from '#services/guardians/guardian_notices'
import GuardianLinkEvents from '#services/guardians/guardian_link_events'
import GuardianLinkRegistry, {
  GUARDIAN_LINKS_TABLE,
} from '#services/guardians/guardian_link_registry'

/** Links finished per job run; the rest wait for the next tick. */
const BATCH = 200

/**
 * Ending guardian links (app/domain/guardians/link_revocation.ts), always
 * in a transaction that locks the link:
 *
 * - the guardian leaves at once (`guardian_unlinked` in the ward's log);
 * - the ward of an active link asks and waits the cooldown: the deadline
 *   is stored, the guardian gets a neutral `revocation_requested` notice
 *   and the ward's log `guardian_revocation_requested`; the ward may
 *   cancel until then (`revocation_cancelled`);
 * - at the deadline access ends by itself (every lookup reads the
 *   deadline) and the job (`finalizeDue`) stores the final state, the
 *   neutral `pairing_ended` notice and `guardian_unlinked`;
 * - a link that never became active ends at once and tells nobody, and
 *   one the ward never confirmed lapses after PENDING_LINK_TTL_HOURS;
 * - deleting an account ends its links the same way, just before the
 *   cascade removes them.
 *
 * Only the link changes: the ward's devices, events and everything else
 * stay.
 */
@inject()
export default class LinkRevocationService {
  constructor(
    protected links: GuardianLinkRegistry,
    protected notices: GuardianNotices,
    protected events: GuardianLinkEvents
  ) {}

  /** Answers the link while it lives on (a scheduled end), null once it ended. */
  async revoke(user: User, linkId: number, now: DateTime): Promise<GuardianLink | null> {
    return retryOnDeadlock(() => this.revokeOnce(user, linkId, now))
  }

  protected revokeOnce(user: User, linkId: number, now: DateTime): Promise<GuardianLink | null> {
    return db.transaction(async (trx) => {
      const { link, role } = await this.links.findLiveForParty(user, linkId, now, {
        trx,
        forUpdate: true,
      })
      const state = link.stateAt(now)
      const cooldownHours = wardRevocationCooldownHours(env.get('WARD_REVOCATION_COOLDOWN_HOURS'))
      const plan = planRevocation({ by: role, state, now: now.toJSDate(), cooldownHours })

      if (plan.kind === 'scheduled') {
        const effectiveAt = DateTime.fromJSDate(plan.effectiveAt, { zone: 'utc' })
        link.revocationRequestedAt = now
        link.revocationEffectiveAt = effectiveAt
        await link.useTransaction(trx).save()
        await this.notices.queue(
          trx,
          link,
          { kind: 'revocation_requested', linkId: link.id, effectiveAt: plan.effectiveAt },
          now
        )
        await this.events.record(
          trx,
          link,
          'guardian_revocation_requested',
          { cooldownHours },
          now,
          { onceAt: now }
        )
        return link
      }
      if (plan.kind === 'immediate') {
        await this.end(trx, link, {
          by: role,
          byUserId: user.id,
          at: now,
          granted: grantsGuardianship(state),
        })
        return null
      }
      return link
    })
  }

  /** The ward withdraws their request to leave. */
  async cancel(ward: User, linkId: number, now: DateTime): Promise<GuardianLink> {
    return retryOnDeadlock(() => this.cancelOnce(ward, linkId, now))
  }

  protected cancelOnce(ward: User, linkId: number, now: DateTime): Promise<GuardianLink> {
    return db.transaction(async (trx) => {
      const link = await this.links.findLive(ward, linkId, 'ward', now, { trx, forUpdate: true })
      if (!canCancelRevocation('ward', link.stateAt(now))) {
        throw new CodedError('E_NO_REVOCATION_PENDING', 409, 'No revocation to cancel')
      }
      link.revocationRequestedAt = null
      link.revocationEffectiveAt = null
      await link.useTransaction(trx).save()
      await this.notices.queue(trx, link, { kind: 'revocation_cancelled', linkId: link.id }, now)
      await this.events.record(trx, link, 'guardian_revocation_cancelled', {}, now, {
        onceAt: now,
      })
      return link
    })
  }

  /**
   * The job side. Pending links past their lifetime are declined in one
   * statement (they granted nothing: no notice, no event). Each link whose
   * ward's deadline has passed is then finished in its own transaction,
   * users rows first like every guardian flow (user_row_locks.ts), the
   * link taken with `FOR UPDATE SKIP LOCKED` while still due, so two
   * containers never finish the same link. Answers how many links ended.
   */
  async finalizeDue(now: DateTime): Promise<number> {
    const lapsed = await db.rawQuery<{ rowCount: number }>(
      `UPDATE ${GUARDIAN_LINKS_TABLE}
          SET status = 'revoked', revoked_at = created_at + make_interval(hours => ?), updated_at = ?
        WHERE status = 'pending' AND created_at <= ?`,
      [PENDING_LINK_TTL_HOURS, now.toJSDate(), this.links.pendingCutoff(now)]
    )

    const due = await this.dueQuery(GuardianLink.query(), now)
      .orderBy('revocation_effective_at')
      .limit(BATCH)
    let finished = 0
    for (const candidate of due) {
      finished += await retryOnDeadlock(() =>
        db.transaction(async (trx) => {
          await lockUserRows(trx, [
            { id: candidate.wardUserId, mode: 'key share' },
            { id: candidate.guardianUserId, mode: 'key share' },
          ])
          const link = await this.dueQuery(GuardianLink.query({ client: trx }), now)
            .where('id', candidate.id)
            .forUpdate()
            .skipLocked()
            .first()
          if (!link) return 0
          await this.end(trx, link, {
            by: 'ward',
            byUserId: link.wardUserId,
            at: link.revocationEffectiveAt!,
            granted: true,
          })
          return 1
        })
      )
    }
    return lapsed.rowCount + finished
  }

  /** The other person of every live link of `user` (to lock their rows before deleting it). */
  async counterpartsOf(user: User, now: DateTime): Promise<number[]> {
    const links = await this.links.liveLinksOf(user, now)
    return links.map((link) =>
      link.wardUserId === user.id ? link.guardianUserId : link.wardUserId
    )
  }

  /**
   * Before an account is deleted, in the deletion's transaction (which has
   * locked the users rows): each guardian of a ward that leaves gets
   * `pairing_ended`; each ward of a guardian that leaves gets
   * `guardian_unlinked` in their log. The links are locked by one
   * statement in id order. Pending links granted nothing and tell nobody.
   */
  async endForDeletedAccount(
    user: User,
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<void> {
    for (const link of await this.links.liveLinksOf(user, now, trx)) {
      if (!grantsGuardianship(link.stateAt(now))) continue
      if (link.wardUserId === user.id) {
        await this.notices.queue(trx, link, { kind: 'pairing_ended', linkId: link.id }, now)
      } else {
        await this.events.record(
          trx,
          link,
          'guardian_unlinked',
          { endedBy: 'guardian', reason: 'account_deleted' },
          now
        )
      }
    }
  }

  protected dueQuery(query: ModelQueryBuilderContract<typeof GuardianLink>, now: DateTime) {
    return query
      .where('status', 'active')
      .whereNotNull('revocation_effective_at')
      .where('revocation_effective_at', '<=', now.toJSDate())
  }

  /** Stores the end; a link that had granted guardianship is recorded (and announced if the ward left). */
  protected async end(
    trx: TransactionClientContract,
    link: GuardianLink,
    ending: { by: LinkRole; byUserId: number; at: DateTime; granted: boolean }
  ): Promise<void> {
    const { by, byUserId, at, granted } = ending
    link.status = 'revoked'
    link.revokedAt = at
    link.revokedByUserId = byUserId
    await link.useTransaction(trx).save()
    if (!granted) return
    await this.events.record(trx, link, 'guardian_unlinked', { endedBy: by, reason: 'revoked' }, at)
    // The guardian who left knows; a guardian left by the ward is told, neutrally.
    if (by === 'ward') {
      await this.notices.queue(trx, link, { kind: 'pairing_ended', linkId: link.id }, at)
    }
  }
}
