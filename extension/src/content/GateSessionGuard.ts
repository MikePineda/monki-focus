// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../shared/clock'
import type { ActiveSession } from '../shared/GateContract'
import {
  commandMessage,
  type CommandMessage,
  type CommandResult,
  type FeedDecision,
} from '../shared/messages'
import type { SessionOverlayView } from './SessionOverlayMount'

/** The slice of `SessionOverlayMount` the guard drives. */
export interface SessionOverlaySlot {
  show(view: SessionOverlayView): void
  clear(): void
}

export interface GateSessionGuardOptions {
  clock: Clock
  send: (message: CommandMessage) => Promise<unknown>
  overlay: SessionOverlaySlot
  /** Asks the feed guard to decide the page again (an override ended). */
  reevaluate: () => void
  /** Whether the user wants the `mm:ss` pill (default on). */
  pillEnabled: () => Promise<boolean>
  /** The page's current URL. */
  currentUrl: () => string
}

/** How often a running intention or override is checked against the clock. */
export const SESSION_CHECK_MS = 1000

function isSession(value: unknown): value is ActiveSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Record<string, unknown>
  return (
    (session.phase === 'active' ||
      session.phase === 'timed_out' ||
      session.phase === 'override_active') &&
    (session.endsAtMs === null || typeof session.endsAtMs === 'number') &&
    (session.minutes === null || typeof session.minutes === 'number') &&
    (session.intention === null || typeof session.intention === 'string') &&
    typeof session.nextPauseSeconds === 'number' &&
    typeof session.site === 'string'
  )
}

/**
 * What a site page does with the engine's decision beyond hiding feeds
 * (E6): a page the engine gates or blocks asks the service worker to send
 * its tab to the gate (SPA navigations that DNR never sees); a page inside a
 * running intention shows the pill and, at `expiresAt` by its own clock,
 * reports the end and shows the timeout overlay (Leave / 5 more min); a
 * page inside an emergency override decides again when it ends. Nothing
 * here decides: every answer comes from the service worker.
 */
export class GateSessionGuard {
  private timer: ReturnType<typeof setInterval> | undefined
  private openedFor: string | null = null

  constructor(private readonly options: GateSessionGuardOptions) {}

  apply(answer: FeedDecision, url: string): void {
    this.stopTimer()
    const { decision } = answer
    const session = isSession(answer.session) ? answer.session : null
    if (decision.reason === 'engine_error') {
      this.options.overlay.clear()
      return
    }
    if (decision.access !== 'allow') {
      if (session?.phase === 'timed_out') {
        this.options.overlay.show({ kind: 'timeout', session })
        return
      }
      this.options.overlay.clear()
      if (this.openedFor !== url) {
        this.openedFor = url
        void this.options.send(commandMessage('gate.open', { url }) as CommandMessage).catch(() => {
          this.openedFor = null
        })
      }
      return
    }
    this.openedFor = null
    if (session?.phase === 'active' && session.endsAtMs !== null) {
      this.runIntention(session.endsAtMs, url)
      return
    }
    if (session?.phase === 'override_active' && session.endsAtMs !== null) {
      this.options.overlay.clear()
      this.watchEnd(session.endsAtMs, () => this.options.reevaluate())
      return
    }
    this.options.overlay.clear()
  }

  /** "5 more min" on the overlay: the tab goes through the gate's doubled pause. */
  async extend(): Promise<void> {
    const url = this.options.currentUrl()
    await this.options.send(commandMessage('intention.extend', { url }) as CommandMessage)
  }

  /** Leave on the overlay: the service worker closes the tab. */
  async leave(): Promise<void> {
    const url = this.options.currentUrl()
    await this.options.send(commandMessage('intention.leave', { url }) as CommandMessage)
  }

  destroy(): void {
    this.stopTimer()
    this.options.overlay.clear()
  }

  private runIntention(endsAt: number, url: string): void {
    void this.options
      .pillEnabled()
      .catch(() => true)
      .then((enabled) => {
        if (this.timer === undefined) return
        if (enabled) this.options.overlay.show({ kind: 'pill', endsAt })
        else this.options.overlay.clear()
      })
    this.watchEnd(endsAt, () => void this.expire(url))
  }

  private watchEnd(endsAt: number, onEnd: () => void): void {
    const check = () => {
      if (this.options.clock.now() < endsAt) return
      this.stopTimer()
      onEnd()
    }
    this.timer = setInterval(check, SESSION_CHECK_MS)
    check()
  }

  private async expire(url: string): Promise<void> {
    try {
      const result = (await this.options.send(
        commandMessage('intention.expired', { url }) as CommandMessage
      )) as CommandResult<'intention.expired'> | undefined
      const session = result?.ok === true ? result.data.session : null
      if (isSession(session) && session.phase === 'timed_out') {
        this.options.overlay.show({ kind: 'timeout', session })
        return
      }
    } catch {
      // No answer: decide again below.
    }
    this.options.reevaluate()
  }

  private stopTimer(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
  }
}
