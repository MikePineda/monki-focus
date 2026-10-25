// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import type { DateTime } from 'luxon'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { ownedBy } from '#services/tenancy/owned_by'
import { drawNtfyTopic } from '#services/guardians/ntfy_topics'
import type { LinkRole } from '#domain/guardians/link_state'
import { defaultMaxUnlockMinutes, maxUnlockMinutesCap } from '#domain/guardians/link_settings'
import { guardianLinkResource, type LinkParties } from '#transformers/guardian_link_transformer'

export const GUARDIAN_LINKS_TABLE = 'guardian_links'

/** A link and the side the signed-in user is on. */
export interface PartyLink {
  readonly link: GuardianLink
  readonly role: LinkRole
}

interface LookupOptions {
  trx?: TransactionClientContract
  /** Lock the row for the rest of the transaction (state changes). */
  forUpdate?: boolean
}

const ROLE_COLUMN: Record<LinkRole, string> = {
  ward: 'ward_user_id',
  guardian: 'guardian_user_id',
}

/**
 * Every lookup of a guardian link, always through one of its two people
 * (app/services/tenancy/owned_by.ts): another user's link, a revoked one
 * or one whose revocation time has passed is a 404, never a 403. A route
 * meant for one side looks the link up through that side only, so the
 * other side gets the same 404 as a stranger.
 */
export default class GuardianLinkRegistry {
  /** Pending and active links of the user, as ward or as guardian, newest first. */
  async listFor(user: User, now: DateTime): Promise<PartyLink[]> {
    const links = await this.live(
      GuardianLink.query().where((either) =>
        either.where('ward_user_id', user.id).orWhere('guardian_user_id', user.id)
      ),
      now
    )
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
    return links.map((link) => ({ link, role: this.roleOf(link, user) }))
  }

  /** Every link of the user, revoked ones included (the export). */
  async historyOf(user: User): Promise<PartyLink[]> {
    const links = await GuardianLink.query()
      .where((either) => either.where('ward_user_id', user.id).orWhere('guardian_user_id', user.id))
      .orderBy('id')
    return links.map((link) => ({ link, role: this.roleOf(link, user) }))
  }

  /** The live link `id` with `user` on the `role` side, or a 404. */
  findLive(
    user: User,
    id: number,
    role: LinkRole,
    now: DateTime,
    options: LookupOptions = {}
  ): Promise<GuardianLink> {
    const query = this.live(ownedBy(GuardianLink, user, ROLE_COLUMN[role]).where('id', id), now)
    return this.scoped(query, options).firstOrFail()
  }

  /** The live link `id` with `user` on either side, or a 404. */
  async findLiveForParty(
    user: User,
    id: number,
    now: DateTime,
    options: LookupOptions = {}
  ): Promise<PartyLink> {
    const query = this.live(
      GuardianLink.query()
        .where('id', id)
        .where((either) =>
          either.where('ward_user_id', user.id).orWhere('guardian_user_id', user.id)
        ),
      now
    )
    const link = await this.scoped(query, options).firstOrFail()
    return { link, role: this.roleOf(link, user) }
  }

  /** Live (pending or active) links of a user on one side, locked (account deletion). */
  liveOn(user: User, role: LinkRole, now: DateTime, trx: TransactionClientContract) {
    return this.live(ownedBy(GuardianLink, user, ROLE_COLUMN[role]), now)
      .useTransaction(trx)
      .forUpdate()
  }

  /** Whether the pair already holds a link that is not revoked (the unique index's rule). */
  async pairIsLinked(
    wardUserId: number,
    guardianUserId: number,
    trx: TransactionClientContract
  ): Promise<boolean> {
    const row = await GuardianLink.query({ client: trx })
      .where('ward_user_id', wardUserId)
      .where('guardian_user_id', guardianUserId)
      .whereNot('status', 'revoked')
      .first()
    return row !== null
  }

  /**
   * A new pending link with a fresh capability topic and the default
   * longest unlock (30 minutes, capped by UNLOCK_TOKEN_MAX_MINUTES).
   */
  createPending(
    trx: TransactionClientContract,
    wardUserId: number,
    guardianUserId: number
  ): Promise<GuardianLink> {
    return GuardianLink.create(
      {
        wardUserId,
        guardianUserId,
        status: 'pending',
        ntfyTopic: drawNtfyTopic(),
        maxUnlockMinutes: defaultMaxUnlockMinutes(
          maxUnlockMinutesCap(env.get('UNLOCK_TOKEN_MAX_MINUTES'))
        ),
        allowNotificationActions: true,
        confirmedAt: null,
        revocationRequestedAt: null,
        revocationEffectiveAt: null,
        revokedAt: null,
        revokedByUserId: null,
      },
      { client: trx }
    )
  }

  /** The resources of some links, loading both people of each once. */
  async present(links: readonly PartyLink[], now: DateTime) {
    const ids = [...new Set(links.flatMap(({ link }) => [link.wardUserId, link.guardianUserId]))]
    const users = new Map(
      (ids.length > 0 ? await User.findMany(ids) : []).map((user) => [user.id, user])
    )
    return links.map(({ link, role }) => {
      const parties: LinkParties = {
        ward: users.get(link.wardUserId)!,
        guardian: users.get(link.guardianUserId)!,
      }
      return guardianLinkResource(link, role, parties, now)
    })
  }

  async presentOne(entry: PartyLink, now: DateTime) {
    const [resource] = await this.present([entry], now)
    return resource
  }

  protected roleOf(link: GuardianLink, user: { id: number }): LinkRole {
    return link.wardUserId === user.id ? 'ward' : 'guardian'
  }

  /** Pending or active, and not past a revocation deadline (link_state.ts). */
  protected live(query: ModelQueryBuilderContract<typeof GuardianLink>, now: DateTime) {
    return query
      .whereIn('status', ['pending', 'active'])
      .where((deadline) =>
        deadline
          .whereNull('revocation_effective_at')
          .orWhere('revocation_effective_at', '>', now.toJSDate())
      )
  }

  protected scoped(query: ModelQueryBuilderContract<typeof GuardianLink>, options: LookupOptions) {
    if (options.trx) query.useTransaction(options.trx)
    if (options.forUpdate) query.forUpdate()
    return query
  }
}
