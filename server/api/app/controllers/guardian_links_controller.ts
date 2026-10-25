// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import Clock from '#services/clock'
import { maxUnlockMinutesCap } from '#domain/guardians/link_settings'
import { confirmLinkValidator, updateLinkValidator } from '#validators/guardians'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'
import LinkConfirmation from '#services/guardians/link_confirmation'
import LinkSettingsService from '#services/guardians/link_settings_service'
import LinkRevocationService from '#services/guardians/link_revocation_service'
import LinkSubscription from '#services/guardians/link_subscription'
import TopicRotation from '#services/guardians/topic_rotation'

/**
 * Guardian links of the signed-in user (dashboard, session + CSRF), as
 * ward or as guardian. Every `:id` is looked up through the user, and a
 * route meant for one side through that side only: anyone else (the
 * other side included) gets a 404.
 */
@inject()
export default class GuardianLinksController {
  constructor(
    protected links: GuardianLinkRegistry,
    protected confirmation: LinkConfirmation,
    protected settings: LinkSettingsService,
    protected revocation: LinkRevocationService,
    protected subscription: LinkSubscription,
    protected rotation: TopicRotation,
    protected clock: Clock
  ) {}

  /** GET /guardian/links: pending and active links, both directions, newest first. */
  async index({ auth }: HttpContext) {
    const now = this.clock.now()
    const links = await this.links.listFor(auth.use('web').getUserOrFail(), now)
    return { links: await this.links.present(links, now) }
  }

  /** PATCH /guardian/links/:id (guardian): `maxUnlockMinutes`, `allowNotificationActions`. */
  async update({ auth, params, request }: HttpContext) {
    const cap = maxUnlockMinutesCap(env.get('UNLOCK_TOKEN_MAX_MINUTES'))
    const changes = await request.validateUsing(updateLinkValidator(cap))
    const now = this.clock.now()
    const link = await this.settings.update(
      auth.use('web').getUserOrFail(),
      Number(params.id),
      changes,
      now
    )
    return { link: await this.links.presentOne({ link, role: 'guardian' }, now) }
  }

  /** POST /guardian/links/:id/confirm (ward): `{ password }`; the link turns active. */
  async confirm({ auth, params, request }: HttpContext) {
    const { password } = await request.validateUsing(confirmLinkValidator)
    const now = this.clock.now()
    const link = await this.confirmation.confirm(
      auth.use('web').getUserOrFail(),
      Number(params.id),
      password,
      now
    )
    return { link: await this.links.presentOne({ link, role: 'ward' }, now) }
  }

  /**
   * POST /guardian/links/:id/revoke (either side): 204 when the link ended
   * (the guardian left, or it never became active); 200 `{ link }` with
   * its deadline when the ward asked and the cooldown runs.
   */
  async revoke({ auth, params, response }: HttpContext) {
    const now = this.clock.now()
    const link = await this.revocation.revoke(
      auth.use('web').getUserOrFail(),
      Number(params.id),
      now
    )
    if (link === null) return response.noContent()
    return { link: await this.links.presentOne({ link, role: 'ward' }, now) }
  }

  /** POST /guardian/links/:id/cancel-revocation (ward): the link stays. */
  async cancelRevocation({ auth, params }: HttpContext) {
    const now = this.clock.now()
    const link = await this.revocation.cancel(
      auth.use('web').getUserOrFail(),
      Number(params.id),
      now
    )
    return { link: await this.links.presentOne({ link, role: 'ward' }, now) }
  }

  /**
   * POST /guardian/links/:id/rotate-topic (either side): `{ link }`, plus
   * `{ subscription }` with the new topic for the guardian only.
   */
  async rotateTopic({ auth, params, response }: HttpContext) {
    const now = this.clock.now()
    const user = auth.use('web').getUserOrFail()
    const { link, role } = await this.rotation.rotate(user, Number(params.id), now)
    const resource = await this.links.presentOne({ link, role }, now)
    response.header('Cache-Control', 'no-store')
    if (role === 'ward') return { link: resource }
    return { link: resource, subscription: this.subscription.of(link) }
  }

  /** GET /guardian/links/:id/subscribe (guardian): the ntfy URL, deep link and QR payload. */
  async subscribe({ auth, params, response }: HttpContext) {
    const subscription = await this.subscription.subscribe(
      auth.use('web').getUserOrFail(),
      Number(params.id),
      this.clock.now()
    )
    response.header('Cache-Control', 'no-store')
    return { subscription }
  }
}
