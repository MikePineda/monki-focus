// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { parse } from 'yaml'
import app from '@adonisjs/core/services/app'
import { createKeyring, decodeBase64Url, parseRfc3339Utc } from '@monki-focus/protocol'
import { BypassAlerts, type RaisedBypassEvent } from '#services/devices/bypass_alerts'

/** A fixed instant for key creation (keys are valid whatever the clock). */
export const KEYS_CREATED_AT = parseRfc3339Utc('2026-01-05T09:00:00Z')!

/** Synthetic request binding values in the protocol's formats. */
export const NONCE = 'AAECAwQFBgcICQoLDA0ODw'
export const OTHER_NONCE = 'EBESExQVFhcYGRobHB0eHw'
export const BOOT = '41'
export const HASH = 'FhXbYQzF27g8nyglmbU0-t5tCOlmD2PshdAxmVZsGuI'

export interface OpenApi {
  paths: Record<string, Record<string, unknown>>
  components: { schemas: Record<string, Record<string, unknown>> }
}

export function openApi(): OpenApi {
  return parse(
    readFileSync(fileURLToPath(import.meta.resolve('@monki-focus/protocol/openapi.yaml')), 'utf8')
  ) as OpenApi
}

/**
 * A validator for one `components.schemas` entry of openapi.yaml. The test
 * instance's issuer is a loopback http origin (development profile), which
 * the release pattern of `KeySet.issuer` refuses on purpose, so only that
 * member is relaxed.
 */
export function contractValidator(schema: string) {
  const schemas = structuredClone(openApi().components.schemas)
  const keySet = schemas.KeySet as { properties: Record<string, unknown> }
  keySet.properties.issuer = { type: 'string' }
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  ajv.addFormat('date-time', true)
  ajv.addSchema({ $id: 'urn:monki-focus:openapi', components: { schemas } })
  return ajv.compile({ $ref: `urn:monki-focus:openapi#/components/schemas/${schema}` })
}

/** Makes sure both purposes have an active key (the web boot does this in production). */
export async function bootKeys() {
  const keys = await app.container.make('signingKeys')
  await keys.ensureKeys(KEYS_CREATED_AT)
  return keys
}

/** The keyring a device would build from the published keys of a purpose. */
export async function publishedKeyring(purpose: 'unlock' | 'policy') {
  const keys = await app.container.make('signingKeys')
  const records = await keys.records()
  const keyring = createKeyring(
    purpose,
    records
      .filter((record) => record.purpose === purpose)
      .map((record) => ({ kid: record.kid, publicKey: decodeBase64Url(record.publicKey)! }))
  )
  if (!keyring.ok) throw new Error('published keys refused')
  return keyring.value
}

/** The kids the instance publishes, as a device pins them. */
export async function instanceKids() {
  const keys = await app.container.make('signingKeys')
  const records = await keys.records()
  return {
    unlock: records.filter((record) => record.purpose === 'unlock').map((record) => record.kid),
    policy: records.filter((record) => record.purpose === 'policy').map((record) => record.kid),
  }
}

/** A valid heartbeat body pinning the instance's own keys. */
export async function heartbeatBody(overrides: Record<string, unknown> = {}) {
  return {
    clientTime: '2026-01-05T09:00:00Z',
    protectionActive: true,
    rulesHash: HASH,
    policyHash: HASH,
    clientVersion: '0.1.0',
    nonce: NONCE,
    boot: BOOT,
    pinnedKids: await instanceKids(),
    ...overrides,
  }
}

/** `Event::fake` for the guardian hand-off: records every raised event. */
export class RecordingBypassAlerts extends BypassAlerts {
  readonly raisedEvents: RaisedBypassEvent[] = []

  async raised(events: readonly RaisedBypassEvent[]): Promise<void> {
    this.raisedEvents.push(...events)
  }

  kinds() {
    return this.raisedEvents.map((event) => event.kind)
  }
}

/** Swaps `BypassAlerts` for a recorder until `app.container.restore(BypassAlerts)`. */
export function fakeBypassAlerts() {
  const recorder = new RecordingBypassAlerts()
  app.container.swap(BypassAlerts, () => recorder)
  return recorder
}

export { BypassAlerts }
