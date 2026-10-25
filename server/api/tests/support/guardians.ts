// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'

/** Tables the guardian specs read directly (never through the services under test). */
export const PAIRING_CODES = 'pairing_codes'
export const GUARDIAN_LINKS = 'guardian_links'
export const OUTBOX = 'notification_outbox'
export const BYPASS_EVENTS = 'bypass_events'

/** The ward asks for a pairing code; answers its body. */
export async function newPairingCode(client: ApiClient, ward: User) {
  const response = await client.post('/api/v1/guardian/pairing-codes').actingAs(ward)
  response.assertStatus(201)
  return response.body() as { code: string; expiresAt: string; qrPayload: string }
}

/** A signed-in guardian redeems a code (optionally from a given client IP). */
export function redeem(client: ApiClient, guardian: User, code: string, ip?: string) {
  const request = client.post('/api/v1/guardian/pairings').json({ code })
  return (ip ? request.header('x-forwarded-for', ip) : request).actingAs(guardian)
}

/** A code with the same lookup part (first 3 digits) and a wrong proof. */
export function wrongGuess(code: string, index = 0) {
  const tails = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999']
  const tail = tails.filter((candidate) => candidate !== code.slice(3))[index]
  return code.slice(0, 3) + tail
}

/** The outbox rows queued for a user, oldest first. */
export async function noticesFor(user: User) {
  return db.from(OUTBOX).where('recipient_user_id', user.id).orderBy('id')
}

/** The server events of a ward's bypass log about guardian links, oldest first. */
export async function guardianEventsOf(ward: User) {
  return db
    .from(BYPASS_EVENTS)
    .where('ward_user_id', ward.id)
    .where('kind', 'like', 'guardian_%')
    .orderBy('id')
}

/** The ward's guardian-link events as `[kind, details]`, oldest first. */
export async function guardianEventLog(ward: User): Promise<Array<[string, unknown]>> {
  const events = await guardianEventsOf(ward)
  return events.map((event) => [event.kind, event.details])
}

/** The reason codes of the notices queued for a user, oldest first. */
export async function noticeKinds(user: User): Promise<string[]> {
  const notices = await noticesFor(user)
  return notices.map((notice) => notice.payload.kind)
}
