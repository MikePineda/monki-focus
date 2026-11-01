// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import UnlockRequest from '#models/unlock_request'
import type { NtfyMessage } from '#domain/notify/ntfy_message'
import { NtfyPublisher, type PublishResult } from '#services/notify/ntfy_publisher'
import { enrolledDevice } from '#tests/factories/device_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { bootKeys, HASH } from '#tests/support/device_api'

/** `Http::fake` for ntfy: records every message; `failing` answers a 503. */
export class RecordingNtfyPublisher extends NtfyPublisher {
  readonly configured = true
  readonly messages: NtfyMessage[] = []
  failing = false

  async publish(message: NtfyMessage): Promise<PublishResult> {
    if (this.failing) return { ok: false, reason: 'ntfy answered 503' }
    this.messages.push(message)
    return { ok: true }
  }
}

/** Swaps the ntfy port for a recorder until `app.container.restore(NtfyPublisher)`. */
export function fakeNtfy() {
  const recorder = new RecordingNtfyPublisher()
  app.container.swap(NtfyPublisher, () => recorder)
  return recorder
}

export { NtfyPublisher }

export const UNLOCK_BODY = {
  ruleId: 'social.video-feed',
  scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
  minutes: 15,
  reason: 'A synthetic reason for the guardian',
}

/** A ward with an active guardian and an enrolled device that already sent its policy hash. */
export async function wardWithGuardian(options: Parameters<typeof guardianPair>[0] = {}) {
  await bootKeys()
  const pair = await guardianPair(options)
  const { device, token } = await enrolledDevice(pair.ward)
  device.policyHash = HASH
  await device.save()
  return { ...pair, device, token }
}

/** A new pending request of the device; answers its uuid. */
export async function newRequestUuid(client: ApiClient, token: string): Promise<string> {
  const response = await createRequest(client, token)
  response.assertStatus(201)
  return response.body().uuid
}

/** The stored status of a request. */
export async function statusOf(uuid: string) {
  const request = await UnlockRequest.findByOrFail('uuid', uuid)
  return request.status
}

export function createRequest(client: ApiClient, token: string, body: object = UNLOCK_BODY) {
  return client.post('/api/v1/device/unlock-requests').json(body).asDevice(token)
}

/** The two action URLs of the last published unlock-request message. */
export function actionUrls(message: NtfyMessage) {
  const urls = message.actions.filter((action) => action.action === 'http').map((a) => a.url)
  return { approve: urls[0], deny: urls[1] }
}

/** Path part of an absolute action URL. */
export function pathOf(url: string) {
  return new URL(url).pathname
}

export async function outboxOf(user: User) {
  return db.from('notification_outbox').where('recipient_user_id', user.id).orderBy('id')
}
