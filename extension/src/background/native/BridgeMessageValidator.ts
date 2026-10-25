// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  validateAppUnavailable,
  validateBrowserActivity,
  validateBrowserFocus,
  validateBypassEvent,
  validateFocusSessionState,
  validateHello,
  validateHelloAck,
  validateRulesSnapshot,
  validateUnlockToken,
} from 'virtual:monki-bridge-validator'
import {
  APP_TO_EXTENSION_TYPES,
  BRIDGE_ENVELOPE_VERSION,
  BRIDGE_MAX_MESSAGE_BYTES,
  EXTENSION_TO_APP_TYPES,
  type AppToExtensionMessage,
  type BridgeDirection,
  type BridgeRejection,
  type ExtensionToAppMessage,
} from './BridgeContract'

type Verdict<Message> = { ok: true; message: Message } | { ok: false; reason: BridgeRejection }

const PAYLOAD_VALIDATORS: Readonly<Record<string, (value: unknown) => boolean>> = {
  'hello': validateHello,
  'browser.focus': validateBrowserFocus,
  'browser.activity': validateBrowserActivity,
  'bypass.event': validateBypassEvent,
  'hello.ack': validateHelloAck,
  'rules.snapshot': validateRulesSnapshot,
  'unlock.token': validateUnlockToken,
  'focusSession.state': validateFocusSessionState,
  'app.unavailable': validateAppUnavailable,
}

const ENVELOPE_KEYS = ['id', 'payload', 'type', 'v']
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/
const encoder = new TextEncoder()

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** UTF-8 size of the compact serialisation (what the wire carries). */
export function serialisedBytes(value: unknown): number {
  try {
    return encoder.encode(JSON.stringify(value)).length
  } catch {
    // Not serialisable at all (a cycle, a BigInt): it cannot be on the wire.
    return Number.POSITIVE_INFINITY
  }
}

function check(value: unknown, direction: BridgeDirection): BridgeRejection | null {
  if (serialisedBytes(value) > BRIDGE_MAX_MESSAGE_BYTES) return 'too_large'
  if (!isPlainObject(value)) return 'invalid_envelope'
  if (Object.keys(value).sort().join() !== ENVELOPE_KEYS.join()) return 'invalid_envelope'
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return 'invalid_envelope'
  if (typeof value.type !== 'string') return 'invalid_envelope'
  if (value.v !== BRIDGE_ENVELOPE_VERSION) return 'unsupported_version'
  const sent: readonly string[] =
    direction === 'extension-to-app' ? EXTENSION_TO_APP_TYPES : APP_TO_EXTENSION_TYPES
  if (!Object.hasOwn(PAYLOAD_VALIDATORS, value.type)) return 'unknown_type'
  if (!sent.includes(value.type)) return 'wrong_direction'
  if (!isPlainObject(value.payload)) return 'payload_not_object'
  const validate = PAYLOAD_VALIDATORS[value.type]
  return validate?.(value.payload) === true ? null : 'invalid_payload'
}

/**
 * Validates a message from the app, in MonkiCore's order (size, envelope,
 * version, type, direction, payload object, payload schema). The
 * `id` pattern uses JavaScript's `$`, which never matches before a final
 * line feed, as in JSON Schema.
 */
export function validateFromApp(value: unknown): Verdict<AppToExtensionMessage> {
  const reason = check(value, 'app-to-extension')
  return reason === null
    ? { ok: true, message: value as AppToExtensionMessage }
    : { ok: false, reason }
}

/** Validates a message before the extension sends it (the app would refuse anything else). */
export function validateToApp(value: unknown): Verdict<ExtensionToAppMessage> {
  const reason = check(value, 'extension-to-app')
  return reason === null
    ? { ok: true, message: value as ExtensionToAppMessage }
    : { ok: false, reason }
}
