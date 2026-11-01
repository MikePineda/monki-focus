// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import RuleSetSync from '#services/rules/rule_set_sync'
import { consumeRuleSetRead, consumeRuleSetWrite } from '#services/rules/rule_set_throttles'
import { revisionTag } from '#domain/rules/rule_set_etag'
import { ruleSetOfRawBody } from '#domain/rules/rule_set_raw_body'
import { DeviceApiError } from '#exceptions/device_api_error'

/**
 * `GET`/`PUT /device/rule-set` (openapi.yaml `getRuleSet`, `putRuleSet`):
 * the device's owner's rule set, never anyone else's (the device guard
 * gives the owner; there is no id to address another set). The document
 * is never logged and every answer is `no-store`.
 */
@inject()
export default class DeviceRuleSetController {
  constructor(
    protected sync: RuleSetSync,
    protected clock: Clock
  ) {}

  /** 200 `{ revision, ruleSet }` with `ETag`, or 304 on a matching `If-None-Match`. */
  async show({ auth, request, response }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    await consumeRuleSetRead({ device: device.id })
    const read = await this.sync.read(device.userId, request.header('if-none-match'))
    response.header('Cache-Control', 'no-store')
    response.header('ETag', revisionTag(read.revision))
    if (read.kind === 'not_modified') return response.notModified()
    return { revision: read.revision, ruleSet: read.ruleSet }
  }

  /** 200 `{ revision }`; 412 `{ code, revision }`; 422 `{ code, fields }`. */
  async update({ auth, request, response }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    await consumeRuleSetWrite({ device: device.id })
    const outcome = await this.sync.write(device.userId, {
      ifMatch: request.header('if-match'),
      ruleSet: ruleSetOfRawBody(request.raw()),
      deviceId: device.id,
      now: this.clock.now(),
    })
    response.header('Cache-Control', 'no-store')
    if (outcome.kind === 'invalid') {
      throw new DeviceApiError('validation_failed', 422, outcome.fields)
    }
    response.header('ETag', revisionTag(outcome.revision))
    if (outcome.kind === 'precondition_failed') {
      return response.status(412).send({ code: outcome.reason, revision: outcome.revision })
    }
    return { revision: outcome.revision }
  }
}
