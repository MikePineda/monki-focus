// SPDX-License-Identifier: AGPL-3.0-or-later
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { TrackingModuleDependencies } from '../../src/background/tracking/TrackingModule'
import type {
  IdleState,
  ListenerEvent,
  TrackedTab,
} from '../../src/background/tracking/TrackingBrowser'

const WINDOW_ID_NONE = -1

class FakeEvent<Listener extends (...args: never[]) => unknown> implements ListenerEvent<Listener> {
  private readonly listeners: Listener[] = []

  addListener(listener: Listener): void {
    this.listeners.push(listener)
  }

  hasListeners(): boolean {
    return this.listeners.length > 0
  }

  trigger(...args: Parameters<Listener>): void {
    for (const listener of this.listeners) listener(...args)
  }
}

export interface FakeTabState {
  url: string
  title?: string
  audible?: boolean
  incognito?: boolean
}

/**
 * A scripted browser for tracking: one window per id, one active tab per
 * window, the user's focus and idle state. Storage, alarms and runtime come
 * from WXT's `fakeBrowser` (reset it in `beforeEach`); `fakeBrowser` keeps
 * a single global active tab, so focus, tabs and idle are modelled here.
 */
export class FakeTrackingBrowser {
  readonly onFocusChanged = new FakeEvent<(windowId: number) => void>()
  readonly onActivated = new FakeEvent<(info: { tabId: number; windowId: number }) => void>()
  readonly onUpdated = new FakeEvent<(tabId: number, change: { url?: string }) => void>()
  readonly onIdleChanged = new FakeEvent<(state: IdleState) => void>()

  private focusedWindow: number | null = 1
  private lastFocusedWindow = 1
  private readonly activeTabs = new Map<number, FakeTabState>()
  private idleState: IdleState = 'active'
  incognitoAllowed = false
  detectionInterval: number | null = null

  readonly api: TrackingModuleDependencies['browser'] = {
    windows: {
      WINDOW_ID_NONE,
      getLastFocused: async () => ({
        id: this.lastFocusedWindow,
        focused: this.focusedWindow === this.lastFocusedWindow,
        incognito: this.activeTabs.get(this.lastFocusedWindow)?.incognito === true,
      }),
      onFocusChanged: this.onFocusChanged,
    },
    tabs: {
      query: async ({ windowId }) => {
        const tab = this.activeTabs.get(windowId)
        if (!tab) return []
        const tracked: TrackedTab = {
          url: tab.url,
          title: tab.title,
          audible: tab.audible ?? false,
          incognito: tab.incognito ?? false,
        }
        return [tracked]
      },
      onActivated: this.onActivated,
      onUpdated: this.onUpdated,
    },
    idle: {
      queryState: async () => this.idleState,
      setDetectionInterval: (seconds) => {
        this.detectionInterval = seconds
      },
      onStateChanged: this.onIdleChanged,
    },
    alarms: fakeBrowser.alarms,
    storage: { local: fakeBrowser.storage.local, session: fakeBrowser.storage.session },
    extension: { isAllowedIncognitoAccess: async () => this.incognitoAllowed },
  }

  /** `tab` is already active in `windowId` (no event: the state before a worker starts). */
  preset(tab: FakeTabState, windowId = this.lastFocusedWindow): void {
    this.activeTabs.set(windowId, tab)
  }

  /** The user switches to (or opens) `tab` in `windowId`. */
  activate(tab: FakeTabState, windowId = this.lastFocusedWindow): void {
    this.activeTabs.set(windowId, tab)
    this.onActivated.trigger({ tabId: windowId * 100, windowId })
  }

  /** The active tab of `windowId` navigates to `url` (title and sound unchanged). */
  navigate(url: string, windowId = this.lastFocusedWindow): void {
    const tab = this.activeTabs.get(windowId)
    this.activeTabs.set(windowId, { ...tab, url })
    this.onUpdated.trigger(windowId * 100, { url })
  }

  /** Sound starts or stops in the active tab, without an event (Chromium sends `audible`, not a URL). */
  setAudible(audible: boolean, windowId = this.lastFocusedWindow): void {
    const tab = this.activeTabs.get(windowId)
    if (tab) this.activeTabs.set(windowId, { ...tab, audible })
  }

  /** Focus moves to `windowId`. */
  focus(windowId: number): void {
    this.focusedWindow = windowId
    this.lastFocusedWindow = windowId
    this.onFocusChanged.trigger(windowId)
  }

  /** Focus leaves the browser (another app, or a DevTools/Brave false negative). */
  blur(): void {
    this.focusedWindow = null
    this.onFocusChanged.trigger(WINDOW_ID_NONE)
  }

  /** Focus comes back to the last window. */
  refocus(): void {
    this.focus(this.lastFocusedWindow)
  }

  setIdle(state: IdleState): void {
    this.idleState = state
    this.onIdleChanged.trigger(state)
  }
}
