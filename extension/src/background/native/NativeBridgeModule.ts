// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import type { Clock } from '../../shared/clock'
import { AggregatorFlag } from './AggregatorFlag'
import { BridgeActivityForwarder } from './BridgeActivityForwarder'
import type { BridgeBrowser } from './BridgeContract'
import { NativeBridgeClient, type AppPush } from './NativeBridgeClient'
import type { ConnectNative } from './NativePort'

interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

interface ListenerEvent<Listener> {
  addListener(listener: Listener): void
}

export interface NativeBridgeModuleDependencies {
  connectNative: ConnectNative
  readLastError?: () => unknown
  extensionVersion: string
  browserKind: BridgeBrowser
  session: SessionArea
  windows: { WINDOW_ID_NONE: number; onFocusChanged: ListenerEvent<(windowId: number) => void> }
  alarms: { onAlarm: ListenerEvent<(alarm: { name: string }) => void> }
  clock: Clock
  setTimer?: (callback: () => void, delayMs: number) => void
  onPush?: (message: AppPush) => void
}

export interface NativeBridgeModule {
  /** Connects and adds the listeners; call from the worker's first turn. */
  start(): void
  client: NativeBridgeClient
  /** For tracking: false while the Mac app aggregates this device. */
  syncBlocks(): Promise<boolean>
  /** For tracking: mirrors a stored pulse to the app. */
  onHeartbeat(next: ActivityEvent | null, closeAt: string | null): void
}

/**
 * Composition root of the native messaging bridge: the client, the dedupe
 * flag and the heartbeat mirror. Without the Mac app (no host, or the app
 * not running) every piece stays quiet and the extension works on its own.
 */
export function createNativeBridgeModule(deps: NativeBridgeModuleDependencies): NativeBridgeModule {
  const aggregator = new AggregatorFlag(deps.session)
  const client = new NativeBridgeClient({
    connectNative: deps.connectNative,
    extensionVersion: deps.extensionVersion,
    browser: deps.browserKind,
    aggregator,
    clock: deps.clock,
    setTimer: deps.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs)),
    ...(deps.readLastError ? { readLastError: deps.readLastError } : {}),
    ...(deps.onPush ? { onPush: deps.onPush } : {}),
  })
  const forwarder = new BridgeActivityForwarder((payload) =>
    client.send('browser.activity', payload)
  )
  return {
    client,
    start() {
      deps.windows.onFocusChanged.addListener((windowId) => {
        client.send('browser.focus', { focused: windowId !== deps.windows.WINDOW_ID_NONE })
      })
      // Any alarm wakes the worker: catch up on a reconnect whose timer died with it.
      deps.alarms.onAlarm.addListener(() => {
        client.ensureConnected()
      })
      client.start()
    },
    syncBlocks: () => aggregator.extensionSyncsBlocks(),
    onHeartbeat: (next, closeAt) => {
      forwarder.record(next, closeAt)
    },
  }
}
