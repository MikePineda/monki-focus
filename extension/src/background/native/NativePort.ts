// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The slice of `chrome.runtime.Port` the bridge client uses, so tests drive
 * it with a fake port (the `FakeNativePort` of tests/support) instead of a
 * real native host.
 */
export interface NativePort {
  postMessage(message: unknown): void
  disconnect(): void
  onMessage: { addListener(listener: (message: unknown) => void): void }
  onDisconnect: { addListener(listener: () => void): void }
}

/** `browser.runtime.connectNative` in production. */
export type ConnectNative = (hostName: string) => NativePort
