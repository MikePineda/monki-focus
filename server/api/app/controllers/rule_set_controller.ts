// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import RuleSetSync from '#services/rules/rule_set_sync'
import { consumeRuleSetRead, consumeRuleSetWrite } from '#services/rules/rule_set_throttles'
import { assertMayStartOwnProtection } from '#services/guardians/guardian_only_accounts'
import { revisionTag } from '#domain/rules/rule_set_etag'
import { ruleSetOfRawBody } from '#domain/rules/rule_set_raw_body'
import type { IfMatchRefusal } from '#domain/rules/rule_set_precondition'

const PRECONDITION_CODES: Record<IfMatchRefusal, string> = {
  if_match_required: 'E_RULE_SET_IF_MATCH_REQUIRED',
  revision_mismatch: 'E_RULE_SET_REVISION_MISMATCH',
  revision_exhausted: 'E_RULE_SET_REVISION_MISMATCH',
}

/**
 * `GET`/`PUT /rule-set` for the signed-in user (the future dashboard
 * editor), with the device routes' `If-Match` semantics. Only the user's
 * own set: a guardian has no route to a ward's rules, and a guardian-only
 * account (which protects no device) is refused like its other
 * own-protection actions (403 `E_GUARDIAN_ONLY_ACCOUNT`).
 */
@inject()
export default class RuleSetController {
  constructor(
    protected sync: RuleSetSync,
    protected clock: Clock
  ) {}

  async show({ auth, request, response }: HttpContext) {
    const user = auth.use('web').getUserOrFail()
    assertMayStartOwnProtection(user)
    await consumeRuleSetRead({ user: user.id })
    const read = await this.sync.read(user.id, request.header('if-none-match'))
    response.header('Cache-Control', 'no-store')
    response.header('ETag', revisionTag(read.revision))
    if (read.kind === 'not_modified') return response.notModified()
    return { revision: read.revision, ruleSet: read.ruleSet }
  }

  async update({ auth, request, response, i18n }: HttpContext) {
    const user = auth.use('web').getUserOrFail()
    assertMayStartOwnProtection(user)
    await consumeRuleSetWrite({ user: user.id })
    const outcome = await this.sync.write(user.id, {
      ifMatch: request.header('if-match'),
      ruleSet: ruleSetOfRawBody(request.raw()),
      deviceId: null,
      now: this.clock.now(),
    })
    response.header('Cache-Control', 'no-store')
    if (outcome.kind === 'invalid') {
      const message = i18n.t('errors.E_RULE_SET_INVALID')
      return response.unprocessableEntity({
        errors: Object.entries(outcome.fields).map(([field, rule]) => ({ field, rule, message })),
      })
    }
    response.header('ETag', revisionTag(outcome.revision))
    if (outcome.kind === 'precondition_failed') {
      const code = PRECONDITION_CODES[outcome.reason]
      return response
        .status(412)
        .send({ message: i18n.t(`errors.${code}`), code, revision: outcome.revision })
    }
    return { revision: outcome.revision }
  }
}
