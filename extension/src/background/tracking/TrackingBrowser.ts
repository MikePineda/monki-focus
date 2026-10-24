// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The slice of the extension APIs tracking uses. Production passes WXT's
 * `browser`; tests pass `fakeBrowser` for storage and alarms plus a scripted
 * fake for focus, tabs and idle (which `fakeBrowser` does not model per
 * window).
 */
export interface ListenerEvent<Listener> {
  addListener(listener: Listener): void
}

export type IdleState = 'active' | 'idle' | 'locked'

export interface TrackedTab {
  url?: string | undefined
  title?: string | undefined
  audible?: boolean | undefined
  incognito: boolean
}

export interface TrackedWindow {
  id?: number | undefined
  focused: boolean
  incognito: boolean
}

export interface TrackingBrowser {
  windows: {
    WINDOW_ID_NONE: number
    getLastFocused(): Promise<TrackedWindow>
    onFocusChanged: ListenerEvent<(windowId: number) => void>
  }
  tabs: {
    query(query: { active: true; windowId: number }): Promise<TrackedTab[]>
    onActivated: ListenerEvent<(info: { tabId: number; windowId: number }) => void>
    onUpdated: ListenerEvent<(tabId: number, change: { url?: string | undefined }) => void>
  }
  idle: {
    queryState(detectionIntervalInSeconds: number): Promise<IdleState>
    setDetectionInterval(intervalInSeconds: number): void
    onStateChanged: ListenerEvent<(state: IdleState) => void>
  }
  alarms: {
    get(name: string): Promise<{ name: string; periodInMinutes?: number | undefined } | undefined>
    create(name: string, info: { periodInMinutes: number; delayInMinutes?: number }): Promise<void>
    onAlarm: ListenerEvent<(alarm: { name: string }) => void>
  }
}
