// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../../shared/clock'
import type { AggregatorFlag } from './AggregatorFlag'
import {
  BRIDGE_ENVELOPE_VERSION,
  BRIDGE_HOST_NAME,
  BRIDGE_SCHEMA_VERSION,
  type AppToExtensionMessage,
  type BridgeBrowser,
  type ExtensionToAppPayloads,
  type ExtensionToAppType,
} from './BridgeContract'
import { validateFromApp, validateToApp } from './BridgeMessageValidator'
import type { ConnectNative, NativePort } from './NativePort'
import { ReconnectBackoff } from './ReconnectBackoff'

export type BridgeState =
  'not-permitted' | 'connecting' | 'connected' | 'unavailable' | 'disconnected'

/** The app messages the rest of the worker may act on. */
export type AppPush = Exclude<AppToExtensionMessage, { type: 'hello.ack' | 'app.unavailable' }>

/** After this many "host not found / forbidden" disconnects in a row, retry slowly. */
export const HOST_MISSING_STRIKES = 3
/** One attempt every 10 minutes while the host stays missing. */
export const HOST_MISSING_RETRY_MS = 600_000

/** Chromium's `lastError` when the host is not installed or does not list this id. */
const HOST_MISSING =
  /native messaging host not found|access to the specified native messaging host is forbidden/i

export interface NativeBridgeClientDependencies {
  connectNative: ConnectNative
  /** Whether the optional `nativeMessaging` permission is granted. */
  hasPermission: () => Promise<boolean>
  /** The extension's manifest version. */
  extensionVersion: string
  browser: BridgeBrowser
  aggregator: Pick<AggregatorFlag, 'set'>
  clock: Clock
  /** `setTimeout` in production. */
  setTimer: (callback: () => void, delayMs: number) => void
  /**
   * Reads (and so clears) `runtime.lastError` after a disconnect: the browser
   * then does not report it unchecked, and a missing host is told apart.
   */
  readLastError?: () => { message?: string | undefined } | undefined
  random?: () => number
  randomId?: () => string
  /**
   * `rules.snapshot`, `unlock.token` and `focusSession.state`, already
   * schema-valid but unauthenticated (any process of the user can serve the
   * socket): rules only through the extension's own rule-change policy or a
   * signed policy, an unlock token only after the PASETO verifier accepts it.
   */
  onPush?: (message: AppPush) => void
}

/**
 * The extension's end of the native messaging bridge to the macOS app
 * (`dev.monkifocus.bridge`, docs/CONTRACTS.md "Native messaging").
 *
 * - Does nothing without the optional `nativeMessaging` permission, which the
 *   user grants from the options page ("Connect the Mac app"): no
 *   `connectNative`, no timer.
 * - Connects and sends `hello` (extension and schema version, browser).
 *   `hello.ack {aggregator: "mac"}` is recorded (the dedupe flag); a
 *   disconnect or `app.unavailable` clears it, and the extension keeps
 *   working on its own without the app.
 * - Reconnects after every disconnect with a 1-60 s jittered backoff, and at
 *   most every 10 minutes once the host has been missing three times in a
 *   row. A timer lost with a sleeping worker is caught up by `ensureConnected()`.
 * - Validates every message both ways against the shared schemas: an invalid
 *   inbound message is ignored, an invalid outbound one is never sent.
 *   Nothing is logged.
 */
export class NativeBridgeClient {
  private port: NativePort | null = null
  private current: BridgeState = 'disconnected'
  private retryAtMs: number | null = null
  private permitted = false
  private stopped = true
  private hostMissingStrikes = 0
  private generation = 0
  private readonly backoff: ReconnectBackoff

  constructor(private readonly deps: NativeBridgeClientDependencies) {
    this.backoff = new ReconnectBackoff(deps.random)
  }

  get state(): BridgeState {
    return this.current
  }

  /** Checks the permission, then connects (or stays idle without it). */
  async start(): Promise<void> {
    const generation = ++this.generation
    const permitted = await this.deps.hasPermission().catch(() => false)
    if (generation !== this.generation) return
    this.permitted = permitted
    if (!permitted) {
      this.current = 'not-permitted'
      return
    }
    this.stopped = false
    this.hostMissingStrikes = 0
    this.backoff.reset()
    this.connect()
  }

  /** Reconnects now if a scheduled retry is overdue (its timer died with the worker). */
  ensureConnected(): void {
    if (this.stopped || !this.permitted || this.port !== null) return
    if (this.retryAtMs === null || this.deps.clock.now() >= this.retryAtMs) this.connect()
  }

  /**
   * Sends one message once the app acknowledged the connection. Returns
   * false when it was not sent: no acknowledged app, or a payload the
   * contract refuses (it never reaches the wire).
   */
  send<Type extends ExtensionToAppType>(
    type: Type,
    payload: ExtensionToAppPayloads[Type]
  ): boolean {
    if (this.current !== 'connected') return false
    return this.post(type, payload)
  }

  /** Disconnects for good (the permission was removed); `start()` begins again. */
  stop(): void {
    this.generation += 1
    this.stopped = true
    this.permitted = false
    this.retryAtMs = null
    const port = this.port
    this.port = null
    this.current = 'not-permitted'
    port?.disconnect()
    void this.deps.aggregator.set(null).catch(() => undefined)
  }

  private connect(): void {
    if (this.stopped || !this.permitted || this.port !== null) return
    this.retryAtMs = null
    let port: NativePort
    try {
      port = this.deps.connectNative(BRIDGE_HOST_NAME)
    } catch {
      this.scheduleReconnect(false)
      return
    }
    this.port = port
    this.current = 'connecting'
    port.onMessage.addListener((message) => {
      if (this.port === port) this.receive(message)
    })
    port.onDisconnect.addListener(() => {
      const error = this.deps.readLastError?.()
      if (this.port !== port) return
      this.port = null
      if (this.current !== 'unavailable') this.current = 'disconnected'
      void this.deps.aggregator.set(null).catch(() => undefined)
      this.scheduleReconnect(HOST_MISSING.test(error?.message ?? ''))
    })
    this.post('hello', {
      extensionVersion: this.deps.extensionVersion,
      schemaVersion: BRIDGE_SCHEMA_VERSION,
      browser: this.deps.browser,
    })
  }

  private receive(raw: unknown): void {
    const verdict = validateFromApp(raw)
    if (!verdict.ok) return
    // Something answered: the host is installed.
    this.hostMissingStrikes = 0
    const message = verdict.message
    switch (message.type) {
      case 'hello.ack':
        this.current = 'connected'
        this.backoff.reset()
        void this.deps.aggregator.set(message.payload.aggregator).catch(() => undefined)
        return
      case 'app.unavailable':
        this.current = 'unavailable'
        void this.deps.aggregator.set(null).catch(() => undefined)
        return
      default:
        if (this.current === 'connected') this.deps.onPush?.(message)
    }
  }

  private post<Type extends ExtensionToAppType>(
    type: Type,
    payload: ExtensionToAppPayloads[Type]
  ): boolean {
    const port = this.port
    if (port === null) return false
    const id = (this.deps.randomId ?? (() => crypto.randomUUID()))()
    const verdict = validateToApp({ v: BRIDGE_ENVELOPE_VERSION, id, type, payload })
    if (!verdict.ok) return false
    try {
      port.postMessage(verdict.message)
      return true
    } catch {
      // The port died under us; onDisconnect schedules the reconnect.
      return false
    }
  }

  private scheduleReconnect(hostMissing: boolean): void {
    if (this.stopped) return
    this.hostMissingStrikes = hostMissing ? this.hostMissingStrikes + 1 : 0
    const backedOff = this.backoff.next()
    const delay =
      this.hostMissingStrikes >= HOST_MISSING_STRIKES ? HOST_MISSING_RETRY_MS : backedOff
    this.retryAtMs = this.deps.clock.now() + delay
    this.deps.setTimer(() => {
      this.ensureConnected()
    }, delay)
  }
}
