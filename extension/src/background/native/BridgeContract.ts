// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WebTabData } from '@monki-focus/rules'

/**
 * The native messaging contract between the extension and the macOS app
 * (`@monki-focus/protocol/schema/bridge`, docs/CONTRACTS.md "Native
 * messaging"). Every message is `{ v: 1, id, type, payload }`; which side
 * may send which type is fixed, so nothing the extension sends can change
 * rules or unlock anything, and nothing the app sends is trusted beyond its
 * schema (an `unlock.token` still has to verify).
 */

/** The native messaging host name in `chrome.runtime.connectNative`. */
export const BRIDGE_HOST_NAME = 'dev.monkifocus.bridge'
export const BRIDGE_ENVELOPE_VERSION = 1
export const BRIDGE_SCHEMA_VERSION = 1
/** Largest serialised message either way (the browser's host-to-extension limit). */
export const BRIDGE_MAX_MESSAGE_BYTES = 1_048_576

export type BridgeDirection = 'extension-to-app' | 'app-to-extension'

export type BridgeBrowser = 'brave' | 'chrome' | 'other'

export interface HelloPayload {
  extensionVersion: string
  schemaVersion: 1
  browser: BridgeBrowser
}

export interface BrowserFocusPayload {
  focused: boolean
}

/** One web tab heartbeat (an ActivityWatch event with web tab data). */
export interface BrowserActivityPayload {
  timestamp: string
  duration: number
  data: WebTabData
}

export interface BypassEventPayload {
  dedupeKey: string
  kind: 'emergency_override'
  occurredAt: string
  details?: { scope?: 'rule' | 'bedtime'; waitSeconds?: number; durationSeconds?: number }
}

export interface HelloAckPayload {
  aggregator: 'mac'
  appVersion: string
  schemaVersion: 1
}

export interface RulesSnapshotPayload {
  issuedAt: string
  /** Opaque here: validate against the rules schema before using it. */
  ruleset: Record<string, unknown>
}

export interface UnlockTokenPayload {
  /** An unverified PASETO v4.public token. */
  token: string
}

export interface FocusSessionStatePayload {
  active: boolean
  endsAt: string | null
}

export type AppUnavailablePayload = Record<string, never>

/** Message types the extension sends, with their payloads. */
export interface ExtensionToAppPayloads {
  'hello': HelloPayload
  'browser.focus': BrowserFocusPayload
  'browser.activity': BrowserActivityPayload
  'bypass.event': BypassEventPayload
}

/** Message types the app (or `monki-bridge` itself) sends, with their payloads. */
export interface AppToExtensionPayloads {
  'hello.ack': HelloAckPayload
  'rules.snapshot': RulesSnapshotPayload
  'unlock.token': UnlockTokenPayload
  'focusSession.state': FocusSessionStatePayload
  'app.unavailable': AppUnavailablePayload
}

export type ExtensionToAppType = keyof ExtensionToAppPayloads
export type AppToExtensionType = keyof AppToExtensionPayloads

export const EXTENSION_TO_APP_TYPES: readonly ExtensionToAppType[] = [
  'hello',
  'browser.focus',
  'browser.activity',
  'bypass.event',
]
export const APP_TO_EXTENSION_TYPES: readonly AppToExtensionType[] = [
  'hello.ack',
  'rules.snapshot',
  'unlock.token',
  'focusSession.state',
  'app.unavailable',
]

export interface BridgeEnvelope<Type extends string, Payload> {
  v: 1
  id: string
  type: Type
  payload: Payload
}

/** Any message the extension may send. */
export type ExtensionToAppMessage = {
  [Type in ExtensionToAppType]: BridgeEnvelope<Type, ExtensionToAppPayloads[Type]>
}[ExtensionToAppType]

/** Any message the extension may receive. */
export type AppToExtensionMessage = {
  [Type in AppToExtensionType]: BridgeEnvelope<Type, AppToExtensionPayloads[Type]>
}[AppToExtensionType]

/** The stable rejection codes, in check order (shared with MonkiCore and the fixtures). */
export type BridgeRejection =
  | 'too_large'
  | 'invalid_json'
  | 'invalid_envelope'
  | 'unsupported_version'
  | 'unknown_type'
  | 'wrong_direction'
  | 'payload_not_object'
  | 'invalid_payload'
