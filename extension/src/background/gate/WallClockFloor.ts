// SPDX-License-Identifier: AGPL-3.0-or-later

/** `storage.local` key of the highest wall clock the gate has seen (epoch ms). */
export const WALL_CLOCK_FLOOR_NAME = 'gate.wallClockFloor'
/** Clock corrections smaller than this (NTP slewing, jitter) are not a rewind. */
export const REWIND_TOLERANCE_MS = 2_000

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

/**
 * The highest wall clock the gate has seen, kept across service worker
 * restarts. Comparing with it (not only with the last escalation event)
 * catches repeated small rewinds: moving the clock forward and back a few
 * minutes at a time never goes behind the last event, but it does go behind
 * the highest time seen. After a rewind the floor starts again at the new
 * wall clock, so the lifts it ended are the only cost. Storage failures
 * only lose the persistence; the floor is kept in memory too.
 */
export class WallClockFloor {
  private highest: number | null | undefined

  constructor(private readonly storage: StorageArea) {}

  /** Records `wallMs`; true when it is behind the highest wall clock seen. */
  async rewound(wallMs: number): Promise<boolean> {
    if (this.highest === undefined) this.highest = await this.stored()
    const rewound = this.highest !== null && wallMs < this.highest - REWIND_TOLERANCE_MS
    if (rewound || this.highest === null || wallMs > this.highest) {
      this.highest = wallMs
      await this.storage.set({ [WALL_CLOCK_FLOOR_NAME]: wallMs }).catch(() => undefined)
    }
    return rewound
  }

  private async stored(): Promise<number | null> {
    try {
      const value = (await this.storage.get(WALL_CLOCK_FLOOR_NAME))[WALL_CLOCK_FLOOR_NAME]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    } catch {
      return null
    }
  }
}
