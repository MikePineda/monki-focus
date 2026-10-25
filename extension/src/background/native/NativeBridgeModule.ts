// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import type { Clock } from '../../shared/clock'
import {
  NATIVE_MESSAGING_PERMISSION,
  type OptionalPermissionsApi,
} from '../../shared/NativeMessagingPermission'
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

type PermissionsChange = (permissions: { permissions?: string[] | undefined }) => void

export interface NativeBridgeModuleDependencies {
  connectNative: ConnectNative
  readLastError?: () => { message?: string | undefined } | undefined
  /** `browser.permissions`: `nativeMessaging` is optional and granted from the options page. */
  permissions: Pick<OptionalPermissionsApi, 'contains'> & {
    onAdded: ListenerEvent<PermissionsChange>
    onRemoved: ListenerEvent<PermissionsChange>
  }
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
  /** Adds the listeners and connects when permitted; call from the worker's first turn. */
  start(): void
  client: NativeBridgeClient
  /** For tracking: whether the extension queues its own blocks for sync. */
  syncBlocks(): Promise<boolean>
  /** For tracking: mirrors a stored pulse to the app. */
  onHeartbeat(next: ActivityEvent | null, closeAt: string | null): void
}

const touchesNativeMessaging = (change: { permissions?: string[] | undefined }) =>
  change.permissions?.includes(NATIVE_MESSAGING_PERMISSION) === true

/**
 * Composition root of the native messaging bridge: the client, the dedupe
 * flag and the heartbeat mirror. Without the permission, the host or the
 * app, every piece stays quiet and the extension works on its own.
 */
export function createNativeBridgeModule(deps: NativeBridgeModuleDependencies): NativeBridgeModule {
  const aggregator = new AggregatorFlag(deps.session)
  const client = new NativeBridgeClient({
    connectNative: deps.connectNative,
    hasPermission: () => deps.permissions.contains({ permissions: [NATIVE_MESSAGING_PERMISSION] }),
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
      deps.permissions.onAdded.addListener((change) => {
        if (touchesNativeMessaging(change)) void client.start()
      })
      deps.permissions.onRemoved.addListener((change) => {
        if (touchesNativeMessaging(change)) client.stop()
      })
      void client.start()
    },
    // The flag `hello.ack` sets is recorded but inert: the Mac app has no
    // uploader yet (M6), and a same-user process could forge the ack, so the
    // extension keeps queueing its own blocks. M6 turns this on together
    // with the Mac uploader and an authenticated aggregator claim.
    syncBlocks: () => Promise.resolve(true),
    onHeartbeat: (next, closeAt) => {
      forwarder.record(next, closeAt)
    },
  }
}
