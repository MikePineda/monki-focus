// SPDX-License-Identifier: AGPL-3.0-or-later

/** Reason codes the gate reports when it recovers from a failure. */
export type GateDiagnosticCode =
  | 'log.unavailable'
  | 'outbox.unavailable'
  | 'bypass.fallbackQueued'
  | 'bypass.unrecorded'
  | 'escalation.invalidEntryDropped'
  | 'escalation.unsaved'
  | 'redirects.keptOnEngineError'
  | 'clock.rewound'
  | 'usage.lastGoodKept'
  | 'usage.unavailable'
  | 'pass.urlTooLong'
  | 'sweep.failed'

/** How many recent codes are kept for a later diagnostics view. */
export const MAX_DIAGNOSTICS = 50

/**
 * A ring of recent reason codes (never a URL, a title or an intention), so
 * a recovered failure leaves a trace without a log line that could carry
 * personal data.
 */
export class GateDiagnostics {
  private readonly recent: { at: number; code: GateDiagnosticCode }[] = []

  constructor(private readonly now: () => number) {}

  report(code: GateDiagnosticCode): void {
    this.recent.push({ at: this.now(), code })
    if (this.recent.length > MAX_DIAGNOSTICS) this.recent.shift()
  }

  /** The recent codes, oldest first. */
  codes(): GateDiagnosticCode[] {
    return this.recent.map((entry) => entry.code)
  }
}
