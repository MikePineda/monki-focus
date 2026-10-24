// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { fakeBrowser } from 'wxt/testing/fake-browser'

type Listener = (...args: unknown[]) => void

function stubEvent() {
  const listeners: Listener[] = []
  return {
    addListener: (listener: Listener) => listeners.push(listener),
    removeListener: (listener: Listener) => listeners.splice(listeners.indexOf(listener), 1),
    hasListener: (listener: Listener) => listeners.includes(listener),
    hasListeners: () => listeners.length > 0,
  }
}

/**
 * Fills the APIs `fakeBrowser` leaves unimplemented (they throw) but the real
 * service worker calls on start: `idle` and
 * `extension.isAllowedIncognitoAccess`. Call after `fakeBrowser.reset()`.
 */
export function stubTrackingApis(options: { idleState?: string; incognito?: boolean } = {}): void {
  Object.assign(fakeBrowser.idle, {
    queryState: async () => options.idleState ?? 'active',
    setDetectionInterval: () => undefined,
    onStateChanged: stubEvent(),
  })
  Object.assign(fakeBrowser.extension, {
    isAllowedIncognitoAccess: async () => options.incognito ?? false,
  })
}
