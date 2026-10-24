// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What the popup and the stats page read about intentions. The intention
 * gate (E6) owns the data and plugs an `IntentionCommands` implementation
 * into `createCommandHandlers`; until it does, every answer says
 * `available: false` and the pages hide the intention parts.
 */
export interface ActiveIntention {
  /** The escalation target group (a rule id, or `bedtime`). */
  targetGroup: string
  /** Normalised domain of the site, never a URL. */
  site: string | null
  /** The typed intention, or null when none was asked for. */
  text: string | null
  /** Epoch milliseconds when the chosen minutes run out. */
  expiresAt: number
}

export type IntentionOutcome = 'on_time' | 'extended' | 'broken' | 'closed'

export const INTENTION_OUTCOMES: readonly IntentionOutcome[] = [
  'on_time',
  'extended',
  'broken',
  'closed',
]

export interface IntentionLogEntry {
  /** Epoch milliseconds the intention (or the close) was recorded. */
  at: number
  site: string | null
  text: string | null
  /** Minutes chosen; null for a close without an intention. */
  minutes: number | null
  outcome: IntentionOutcome
}

export interface ActiveIntentionAnswer {
  available: boolean
  active: ActiveIntention | null
}

export interface IntentionLogAnswer {
  available: boolean
  /** Most recent first. */
  entries: IntentionLogEntry[]
}

/** The intention gate's read/end side, as the command handlers call it. */
export interface IntentionCommands {
  active(): Promise<ActiveIntention | null>
  /** Ends the active intention of `targetGroup` now (the user chose to stop early). */
  end(targetGroup: string): Promise<boolean>
  log(): Promise<IntentionLogEntry[]>
}
