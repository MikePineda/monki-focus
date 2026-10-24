// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TrackedWindow } from './TrackingBrowser'

/**
 * Whether a browser window counts as focused. Brave and DevTools briefly
 * report `WINDOW_ID_NONE` (or an unfocused last window) while the user is
 * still in the browser, so focus loss only counts once it has lasted
 * `graceMs`; until then the last focused window keeps counting.
 */
export class WindowFocusGrace {
  private lostAtMs: number | null = null

  constructor(private readonly graceMs: number) {}

  /** `windows.onFocusChanged(WINDOW_ID_NONE)` at `atMs`. */
  focusLost(atMs: number): void {
    this.lostAtMs ??= atMs
  }

  /** `windows.onFocusChanged(<window id>)`. */
  focusGained(): void {
    this.lostAtMs = null
  }

  /** When the current focus loss started, or `null` while focused. */
  lostAt(): number | null {
    return this.lostAtMs
  }

  isFocused(window: TrackedWindow, nowMs: number): boolean {
    if (window.id === undefined) return false
    if (this.lostAtMs !== null) return nowMs - this.lostAtMs < this.graceMs
    return window.focused
  }
}
