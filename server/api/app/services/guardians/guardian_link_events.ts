// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import {
  checkGuardianEventDetails,
  type GuardianEventKind,
} from '#domain/guardians/guardian_event_details'
import BypassEventRecorder from '#services/devices/bypass_event_recorder'

/**
 * Writes a guardian link's server events into the ward's bypass log, in
 * the caller's transaction: `source = 'server'`, no device, a dedupe key
 * in the `s:` namespace (`s:<kind>:<link id>[:<instant>]`), details checked
 * against the kind's allowlist (a violation is a programming error and
 * fails the request rather than store something the guardian must not
 * see).
 */
@inject()
export default class GuardianLinkEvents {
  constructor(protected recorder: BypassEventRecorder) {}

  async record(
    trx: TransactionClientContract,
    link: { readonly id: number; readonly wardUserId: number },
    kind: GuardianEventKind,
    details: Record<string, string | number>,
    now: DateTime,
    options: { onceAt?: DateTime } = {}
  ): Promise<void> {
    const checked = checkGuardianEventDetails(kind, details)
    if (!checked.ok) throw new Error(`guardian event details refused (${kind}: ${checked.reason})`)
    const parts: Array<string | number> = [link.id]
    if (options.onceAt) parts.push(options.onceAt.toMillis())
    await this.recorder.record(
      [
        {
          wardUserId: link.wardUserId,
          deviceId: null,
          kind,
          source: 'server',
          dedupeKey: serverDedupeKey(kind, ...parts),
          occurredAt: now.toJSDate(),
          details: checked.value,
        },
      ],
      now.toJSDate(),
      trx
    )
  }
}
