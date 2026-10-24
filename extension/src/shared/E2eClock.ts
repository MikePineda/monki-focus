// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from './clock'

/**
 * `storage.local` key the e2e build reads a wall-clock offset from, so a
 * spec can move the gate's time forward (a 5-minute intention, the 2-minute
 * emergency wait) without waiting. Only `import.meta.env.MODE === 'e2e'`
 * builds construct this clock; production bundles drop it.
 */
export const E2E_CLOCK_OFFSET_NAME = 'e2e.clockOffsetMs'

interface OffsetStorage {
  get(key: string): Promise<Record<string, unknown>>
}

interface OffsetChanges {
  addListener(
    listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
  ): void
}

export interface E2eClock extends Clock {
  /** Resolves once the stored offset has been read. */
  ready: Promise<void>
}

function offsetOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** The system clock shifted by the stored offset, which it follows live. */
export function e2eClock(storage: OffsetStorage, changes: OffsetChanges, base: Clock): E2eClock {
  let offset = 0
  changes.addListener((changed, areaName) => {
    if (areaName === 'local' && Object.hasOwn(changed, E2E_CLOCK_OFFSET_NAME)) {
      offset = offsetOf(changed[E2E_CLOCK_OFFSET_NAME]?.newValue)
    }
  })
  const ready = storage
    .get(E2E_CLOCK_OFFSET_NAME)
    .then((stored) => {
      offset = offsetOf(stored[E2E_CLOCK_OFFSET_NAME])
    })
    .catch(() => undefined)
  return {
    ready,
    now: () => base.now() + offset,
    monotonic: () => base.monotonic(),
  }
}
