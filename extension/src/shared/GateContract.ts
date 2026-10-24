// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Gate } from '@monki-focus/rules/pure'

/**
 * What the intention gate page and the content-script overlay receive from
 * the service worker. Every state comes from `@monki-focus/engine`
 * (`decide`, `nextEscalation`); these are only its view models. Times are
 * epoch milliseconds in the service worker's clock; the pages derive every
 * countdown from them (`endsAt - now`), never from accumulated ticks.
 */

/** The allowed durations of an intention (the engine's `commit.minutes`). */
export const INTENTION_MINUTES = [5, 10, 15] as const
export type IntentionMinutes = (typeof INTENTION_MINUTES)[number]

/** The longest intention the gate accepts (characters). */
export const MAX_INTENTION_LENGTH = 280
/** The longest search the gate's search box sends (characters). */
export const MAX_GATE_SEARCH_LENGTH = 200

/** Why a destination is blocked (only Close and Emergency are offered). */
export type GateBlockReason =
  'budget_exhausted' | 'schedule_bedtime' | 'rule_match' | 'engine_error'

/** The context line: "reddit.com · 3 visits today · 42 min today". */
export interface GateContext {
  /** The destination's normalised host (never a path or a query). */
  site: string
  visitsToday: number
  minutesToday: number
}

/** The level indicator: "Level 2 of 3 · 1 intention extended today · next pause: 30 s". */
export interface GateLevelInfo {
  level: Gate['level']
  brokenToday: number
  /** The pause the next attempt would get (from the engine). */
  nextPauseSeconds: number
}

export type GateView =
  /** No pending destination for this tab (or opened by hand): only Close. */
  | { kind: 'none' }
  /** The destination is allowed now: the page moves on to it. */
  | { kind: 'pass'; url: string }
  | {
      kind: 'friction'
      context: GateContext
      phase: 'pausing' | 'asking'
      gate: Gate
      pauseEndsAtMs: number
      /** The doubled pause of "5 more min": 5 minutes follow it, no question asked. */
      extension: boolean
      level: GateLevelInfo
      /** Whether a guardian is linked (phase 3; always false today). */
      guardianLinked: boolean
      /** Reddit and YouTube offer a search box that is never gated. */
      searchAvailable: boolean
      /** Picks the rotating placeholder example. */
      exampleIndex: number
    }
  | {
      kind: 'blocked'
      context: GateContext
      reason: GateBlockReason
      emergencyAvailable: boolean
      /** `engine_error`: continue with the feeds hidden, as on the site itself. */
      continueAvailable: boolean
    }
  | { kind: 'waiting'; context: GateContext; readyAtMs: number }
  | {
      kind: 'timed_out'
      context: GateContext
      minutes: number | null
      intention: string | null
      /** The pause "5 more min" costs (the engine's `extend`). */
      nextPauseSeconds: number
    }

/** Why a commit was refused (reason codes; the page translates them). */
export type CommitRejection = 'intention.tooFewWords' | 'intention.sameAsLast'

export type CommitResult =
  { accepted: true; view: GateView } | { accepted: false; rejection: CommitRejection }

/**
 * The intention or emergency access a site page is inside, for the
 * content script's pill and timeout overlay.
 */
export interface ActiveSession {
  phase: 'active' | 'timed_out' | 'override_active'
  /** When the intention or the override ends (null once timed out). */
  endsAtMs: number | null
  minutes: number | null
  intention: string | null
  /** The pause "5 more min" would cost now (the engine's `extend`). */
  nextPauseSeconds: number
  site: string
}
