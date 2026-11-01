// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Device from '#models/device'
import GuardianLink from '#models/guardian_link'
import UnlockRequest from '#models/unlock_request'
import User from '#models/user'
import { grantsGuardianship } from '#domain/guardians/link_state'
import {
  actionHashesMatch,
  actionTokenHash,
  isActionToken,
  isActionUsable,
} from '#domain/unlock/action_token'
import { grantedMinutes } from '#domain/unlock/unlock_minutes'
import {
  decideRequest,
  type DecisionChannel,
  type UnlockDecision,
} from '#domain/unlock/unlock_request_state'
import { lockUserRows } from '#services/database/user_row_locks'
import { retryOnDeadlock } from '#services/database/deadlock_retry'
import UnlockNotifications from '#services/unlock/unlock_notifications'
import OutboxDispatcher from '#services/notify/outbox_dispatcher'
import { instanceMinutesCeiling } from '#services/unlock/unlock_request_creation'

export const UNLOCK_TOKEN_SEAL_PURPOSE = 'unlock_token'

/** Why a decision did not happen. The action route answers every one the same way. */
export type DecisionFailure = 'not_found' | 'closed'

export type DecisionOutcome =
  | { readonly ok: true; readonly request: UnlockRequest }
  | { readonly ok: false; readonly reason: DecisionFailure }

interface DecisionInput {
  readonly decision: UnlockDecision
  readonly channel: DecisionChannel
  readonly approvedMinutes?: number
}

/**
 * The guardian approves or denies a request, from the dashboard (`web`)
 * or an ntfy action button (`notification`). One transaction: the users
 * rows first (user_row_locks.ts; the guardian's in `no key update`, as
 * the decision depends on their second factor), then the request
 * `FOR UPDATE`. Everything is re-checked under the locks: the link still
 * grants guardianship, the guardian still has two-step verification, the
 * state machine accepts the decision (a second decision or an expired
 * request is refused), and for actions the capability is unused, unexpired
 * and allowed by the link. An approval signs the PASETO unlock token
 * (ledger row in the same transaction); any decision clears both action
 * hashes and queues the confirmation.
 */
@inject()
export default class UnlockDecisions {
  constructor(
    protected notifications: UnlockNotifications,
    protected dispatcher: OutboxDispatcher
  ) {}

  /** From the dashboard: `requestUuid` of a request addressed to `guardian`. */
  async decideFromWeb(
    guardian: User,
    requestUuid: string,
    decision: UnlockDecision,
    approvedMinutes: number | undefined,
    now: DateTime
  ): Promise<DecisionOutcome> {
    const found = await UnlockRequest.findBy('uuid', requestUuid)
    if (!found) return { ok: false, reason: 'not_found' }
    return this.decide(found.id, now, (_request, link) =>
      link.guardianUserId === guardian.id ? { decision, channel: 'web', approvedMinutes } : null
    )
  }

  /** From an ntfy action: the token picks the request and the decision. */
  async decideFromAction(token: string, now: DateTime): Promise<DecisionOutcome> {
    if (!isActionToken(token)) return { ok: false, reason: 'not_found' }
    const hash = actionTokenHash(token)
    const found = await UnlockRequest.query()
      .where('approve_action_hash', hash)
      .orWhere('deny_action_hash', hash)
      .first()
    if (!found) return { ok: false, reason: 'not_found' }
    return this.decide(found.id, now, (request, link) => {
      if (!link.allowNotificationActions) return null
      if (!isActionUsable(request.actionExpiresAt?.toJSDate() ?? null, now.toJSDate())) return null
      if (actionHashesMatch(hash, request.approveActionHash)) {
        return { decision: 'approve', channel: 'notification' }
      }
      if (actionHashesMatch(hash, request.denyActionHash)) {
        return { decision: 'deny', channel: 'notification' }
      }
      return null
    })
  }

  protected async decide(
    requestId: number,
    now: DateTime,
    authorize: (request: UnlockRequest, link: GuardianLink) => DecisionInput | null
  ): Promise<DecisionOutcome> {
    const outcome = await retryOnDeadlock(() =>
      db.transaction((trx) => this.decideOnce(trx, requestId, now, authorize))
    )
    if (outcome.ok && outcome.outboxId !== null) {
      await this.dispatcher.dispatchRow(outcome.outboxId, now)
    }
    return outcome.ok ? { ok: true, request: outcome.request } : outcome
  }

  protected async decideOnce(
    trx: TransactionClientContract,
    requestId: number,
    now: DateTime,
    authorize: (request: UnlockRequest, link: GuardianLink) => DecisionInput | null
  ): Promise<
    | { ok: true; request: UnlockRequest; outboxId: number | null }
    | { ok: false; reason: DecisionFailure }
  > {
    const peek = await UnlockRequest.query({ client: trx }).where('id', requestId).first()
    if (!peek || peek.guardianLinkId === null) return { ok: false, reason: 'not_found' }
    const linkPeek = await GuardianLink.query({ client: trx })
      .where('id', peek.guardianLinkId)
      .first()
    if (!linkPeek) return { ok: false, reason: 'not_found' }

    await lockUserRows(trx, [
      { id: linkPeek.wardUserId, mode: 'key share' },
      { id: linkPeek.guardianUserId, mode: 'no key update' },
    ])
    const request = await UnlockRequest.query({ client: trx })
      .where('id', requestId)
      .forUpdate()
      .first()
    const link = await GuardianLink.query({ client: trx }).where('id', linkPeek.id).first()
    const guardian = await User.query({ client: trx }).where('id', linkPeek.guardianUserId).first()
    if (!request || !link || !guardian || request.guardianLinkId !== link.id) {
      return { ok: false, reason: 'not_found' }
    }
    if (!guardian.twoFactorEnabled || !grantsGuardianship(link.stateAt(now))) {
      return { ok: false, reason: 'not_found' }
    }
    const input = authorize(request, link)
    if (!input) return { ok: false, reason: 'not_found' }

    const next = decideRequest(request.timeline(), input.decision, now.toJSDate())
    if (!next.ok) return { ok: false, reason: 'closed' }

    let minutes = request.grantedMinutes ?? request.requestedMinutes
    if (next.value === 'approved') {
      minutes = grantedMinutes({
        requested: request.requestedMinutes,
        approved: input.approvedMinutes,
        linkMax: link.maxUnlockMinutes,
        ceiling: instanceMinutesCeiling(),
      })
      const device = await Device.query({ client: trx }).where('id', request.deviceId).firstOrFail()
      const issuance = await app.container.make('tokenIssuance')
      const issued = await issuance.issueUnlock(
        {
          subject: String(request.wardUserId),
          deviceUuid: device.uuid,
          rule: request.ruleId,
          scope: request.scope,
          durationSeconds: minutes * 60,
          requestUuid: request.uuid,
          policyHash: request.policyHash,
        },
        trx
      )
      if (!issued.ok) throw new Error(`unlock token not issued: ${issued.reason}`)
      request.tokenSealed = encryption.encrypt(
        issued.value.token,
        undefined,
        UNLOCK_TOKEN_SEAL_PURPOSE
      )
      request.grantedMinutes = minutes
    }

    request.status = next.value
    request.decidedByUserId = guardian.id
    request.decidedVia = input.channel
    request.decidedAt = now
    request.approveActionHash = null
    request.denyActionHash = null
    request.actionExpiresAt = null
    request.updatedAt = now
    await request.useTransaction(trx).save()

    const outboxId = await this.notifications.queueDecision(
      trx,
      link,
      { uuid: request.uuid, decision: next.value, minutes },
      now
    )
    return { ok: true, request, outboxId }
  }
}
