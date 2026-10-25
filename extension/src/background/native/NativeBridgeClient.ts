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

export type BridgeState = 'connecting' | 'connected' | 'unavailable' | 'disconnected'

/** The app messages the rest of the worker may act on. */
export type AppPush = Exclude<AppToExtensionMessage, { type: 'hello.ack' | 'app.unavailable' }>

export interface NativeBridgeClientDependencies {
  connectNative: ConnectNative
  /** The extension's manifest version. */
  extensionVersion: string
  browser: BridgeBrowser
  aggregator: Pick<AggregatorFlag, 'set'>
  clock: Clock
  /** `setTimeout` in production. */
  setTimer: (callback: () => void, delayMs: number) => void
  /** Touches `runtime.lastError` after a disconnect, so the browser does not report it unchecked. */
  readLastError?: () => unknown
  random?: () => number
  randomId?: () => string
  /**
   * `rules.snapshot`, `unlock.token` and `focusSession.state`, already
   * schema-valid. Nothing here is trusted beyond its shape: an unlock token
   * must still verify before it unlocks anything.
   */
  onPush?: (message: AppPush) => void
}

/**
 * The extension's end of the native messaging bridge to the macOS app
 * (`dev.monkifocus.bridge`, docs/CONTRACTS.md "Native messaging").
 *
 * - Connects with `connectNative` and sends `hello` (extension and schema
 *   version, browser). `hello.ack {aggregator: "mac"}` marks the app as this
 *   device's aggregator (the dedupe flag); a disconnect or `app.unavailable`
 *   clears it, so the extension keeps working on its own without the app.
 * - Reconnects after every disconnect with a 1-60 s jittered backoff. A timer
 *   lost with a sleeping worker is caught up by `ensureConnected()`.
 * - Validates every message both ways against the shared schemas: an invalid
 *   inbound message is ignored, an invalid outbound one is never sent.
 *   Nothing is logged.
 */
export class NativeBridgeClient {
  private port: NativePort | null = null
  private current: BridgeState = 'disconnected'
  private retryAtMs: number | null = null
  private stopped = false
  private readonly backoff: ReconnectBackoff

  constructor(private readonly deps: NativeBridgeClientDependencies) {
    this.backoff = new ReconnectBackoff(deps.random)
  }

  get state(): BridgeState {
    return this.current
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  /** Reconnects now if a scheduled retry is overdue (its timer died with the worker). */
  ensureConnected(): void {
    if (this.stopped || this.port !== null) return
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

  stop(): void {
    this.stopped = true
    const port = this.port
    this.port = null
    this.current = 'disconnected'
    port?.disconnect()
    void this.deps.aggregator.set(null).catch(() => undefined)
  }

  private connect(): void {
    if (this.stopped || this.port !== null) return
    this.retryAtMs = null
    let port: NativePort
    try {
      port = this.deps.connectNative(BRIDGE_HOST_NAME)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.port = port
    this.current = 'connecting'
    port.onMessage.addListener((message) => {
      if (this.port === port) this.receive(message)
    })
    port.onDisconnect.addListener(() => {
      this.deps.readLastError?.()
      if (this.port !== port) return
      this.port = null
      if (this.current !== 'unavailable') this.current = 'disconnected'
      void this.deps.aggregator.set(null).catch(() => undefined)
      this.scheduleReconnect()
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

  private scheduleReconnect(): void {
    if (this.stopped) return
    const delay = this.backoff.next()
    this.retryAtMs = this.deps.clock.now() + delay
    this.deps.setTimer(() => {
      this.ensureConnected()
    }, delay)
  }
}
