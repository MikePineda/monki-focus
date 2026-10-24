// SPDX-License-Identifier: AGPL-3.0-or-later
import { instantOf } from '@monki-focus/engine'
import type { Clock } from '../../shared/clock'
import type { ActiveTabProbe } from './ActiveTabProbe'
import type { HeartbeatRecorder } from './HeartbeatRecorder'

export interface Pulse {
  /** Epoch ms at which the previous state ended, when the trigger knows it. */
  closeAtMs: number | null
}

/**
 * One pulse = probe the active tab, then record the heartbeat. Pulses run one
 * at a time in arrival order: `tabs.onActivated` and `tabs.onUpdated` often
 * fire together and must not interleave their read-merge-write of the open
 * event.
 */
export class ActivityTracker {
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly clock: Clock,
    private readonly probe: Pick<ActiveTabProbe, 'probe'>,
    private readonly recorder: Pick<HeartbeatRecorder, 'record'>
  ) {}

  pulse({ closeAtMs }: Pulse): Promise<void> {
    const run = this.queue.then(async () => {
      const nowMs = this.clock.now()
      const next = await this.probe.probe(nowMs)
      const closeAt = closeAtMs === null ? null : instantOf(Math.min(closeAtMs, nowMs))
      await this.recorder.record(next, closeAt)
    })
    // A failed pulse (a closed tab, a storage hiccup) must not stop later ones.
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Resolves once every pulse started so far has finished. */
  settled(): Promise<void> {
    return this.queue
  }
}
