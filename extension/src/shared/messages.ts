// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, UtcInstant } from '@monki-focus/rules/pure'
import {
  INTENTION_MINUTES,
  MAX_GATE_SEARCH_LENGTH,
  MAX_INTENTION_LENGTH,
  type ActiveSession,
  type CommitResult,
  type GateView,
  type IntentionMinutes,
} from './GateContract'
import { isGuardAttributes, type GuardAttributes } from './GuardAttributes'
import type { ActiveIntentionAnswer, IntentionLogAnswer } from './IntentionContract'
import {
  EXPORT_FORMATS,
  type DeletedLocalData,
  type ExportedFile,
  type ExportFormat,
} from './LocalDataContract'
import { isPreferenceChange, type PreferenceChange, type Preferences } from './PreferenceContract'
import type { RuleChangeOutcome, RuleChangeProposal, RulesState } from './RuleChangeContract'
import type { IncognitoAccess, TodayStats, WeekStats } from './StatsContract'

/**
 * Typed command contract between the extension contexts (popup, options,
 * gate, content scripts) and the service worker, which is the only writer of
 * state. Every command is `{ v, type, payload }`; the answer is a
 * `CommandResult` that carries a reason code, never user-facing text.
 *
 * `gate.*` commands come only from the extension's own gate page in a tab
 * (`GATE_PAGE_COMMANDS`); `gate.open` and `intention.*` come from the feed
 * guard of a site page (`TAB_URL_COMMANDS`).
 */
export const MESSAGE_VERSION = 1

/** The longest page URL a content script may ask about (longer: malformed). */
export const MAX_COMMAND_URL_LENGTH = 4096

/**
 * What the feed guard needs for one page: the engine's decision plus the
 * surfaces to hide, all derived from `normalizeUrl(...).surface` and
 * `decide(...).content` (the extension never decides which paths are feeds).
 */
export interface FeedDecision {
  /** The page's surface as the engine normalises the URL, or null. */
  surface: string | null
  decision: Decision
  /** Surfaces whose page content is hidden (`data-mf-hide`). */
  hide: string[]
  /**
   * Feed surfaces of the same site that the rule set restricts (hidden or
   * blocked): their entry points (nav links, Shorts shelves) are hidden on
   * every page of the site (`data-mf-restrict`).
   */
  restrict: string[]
  /**
   * The earliest `validUntil` of the decisions this answer is made of (the
   * page's and the restricted surfaces'): the page asks again then at the
   * latest (SEMANTICS.md §5.6). Null when none has one (`engine_error`).
   */
  validUntil: UtcInstant | null
  /** The intention or emergency access this page is inside (E6), if any. */
  session?: ActiveSession
}

/** The DNR redirect's hand-off: the session ticket proves the rule wrote `to`. */
export interface GateHandoff {
  ticket: string
  to: string
}

/** The gate page's tab is closed (or replaced by a new tab when it was the last one). */
export interface ClosedAnswer {
  closed: boolean
}

export interface CommandMap {
  /** Liveness probe; answers the service worker's wall-clock time. */
  'system.ping': { request: Record<string, never>; response: { at: number } }
  /** Feed decision for the page a content script runs in. */
  'decision.get': { request: { url: string }; response: FeedDecision }
  /**
   * The feed guard of a page asks for its stylesheet with the `USER` origin
   * (`scripting.insertCSS`), keyed on the page's random attribute names.
   */
  'feedGuard.attach': {
    request: { url: string; attributes: GuardAttributes }
    response: { injected: boolean }
  }
  /** Today's pulse, levels, top sites and intentions (popup). */
  'stats.today': { request: Record<string, never>; response: TodayStats }
  /** Seven daily pulses and weekday × hour averages (stats page). */
  'stats.week': { request: Record<string, never>; response: WeekStats }
  /** Whether incognito access is allowed (popup warning). */
  'privacy.incognitoAccess': { request: Record<string, never>; response: IncognitoAccess }
  /** The gate page of a tab asks what to show (and hands off the DNR destination once). */
  'gate.load': { request: { handoff: GateHandoff | null }; response: GateView }
  /** The pause on screen has run out. */
  'gate.pauseDone': { request: Record<string, never>; response: GateView }
  /** "Continue to <site>": commit to an intention for some minutes. */
  'gate.commit': {
    request: { minutes: IntentionMinutes; intention: string }
    response: CommitResult
  }
  /** Close: closes the gate's tab (or opens a new tab if it is the last one). */
  'gate.close': { request: Record<string, never>; response: ClosedAnswer }
  /** Emergency: starts the 2-minute wait. */
  'gate.emergency': { request: Record<string, never>; response: GateView }
  /** The emergency wait has run out: 15 minutes of access, recorded as a bypass. */
  'gate.emergencyDone': { request: Record<string, never>; response: GateView }
  /** Cancels the emergency wait and goes back to the gate. */
  'gate.emergencyCancel': { request: Record<string, never>; response: GateView }
  /** Timed out on the gate page: leave (closes the tab). */
  'gate.leave': { request: Record<string, never>; response: ClosedAnswer }
  /** Timed out on the gate page: 5 more minutes (a broken intention). */
  'gate.extend': { request: Record<string, never>; response: GateView }
  /** `engine_error` on the gate: continue with the feeds hidden. */
  'gate.continue': { request: Record<string, never>; response: GateView }
  /** The gate's search box: answers the site search URL to open (never gated). */
  'gate.search': { request: { query: string }; response: GateView }
  /** A site page whose decision gates or blocks it asks to be sent to the gate. */
  'gate.open': { request: { url: string }; response: { opened: boolean } }
  /** The page's intention timer reached zero. */
  'intention.expired': { request: { url: string }; response: { session: ActiveSession | null } }
  /** Timeout overlay: Leave (closes the tab). */
  'intention.leave': { request: { url: string }; response: ClosedAnswer }
  /** Timeout overlay: 5 more minutes (the tab goes through the doubled pause). */
  'intention.extend': { request: { url: string }; response: { opened: boolean } }
  /** The effective and the pending rule set (options page). */
  'rules.state': { request: Record<string, never>; response: RulesState }
  /** A whole edited rule set, judged by the engine's rule-change policy. */
  'rules.propose': { request: RuleChangeProposal; response: RuleChangeOutcome }
  /** Drops the pending (loosening) change; never loosens anything. */
  'rules.cancelPending': { request: Record<string, never>; response: RulesState }
  'preferences.get': { request: Record<string, never>; response: Preferences }
  'preferences.set': { request: PreferenceChange; response: Preferences }
  /** The user's own local data as a file (ActivityWatch JSON or CSV). */
  'data.export': { request: { format: ExportFormat }; response: ExportedFile }
  /** Erases tracked activity and history (the rule set and preferences stay). */
  'data.deleteAll': { request: Record<string, never>; response: DeletedLocalData }
  /** The running intention, when the intention gate (E6) provides one. */
  'intention.active': { request: Record<string, never>; response: ActiveIntentionAnswer }
  'intention.end': { request: { targetGroup: string }; response: { ended: boolean } }
  'intention.log': { request: Record<string, never>; response: IntentionLogAnswer }
}

export type CommandType = keyof CommandMap
export type CommandRequest<T extends CommandType> = CommandMap[T]['request']
export type CommandResponse<T extends CommandType> = CommandMap[T]['response']

export interface CommandMessage<T extends CommandType = CommandType> {
  v: typeof MESSAGE_VERSION
  type: T
  payload: CommandRequest<T>
}

export type CommandErrorCode =
  'sender.rejected' | 'message.malformed' | 'command.unknown' | 'command.failed'

export type CommandResult<T extends CommandType = CommandType> =
  { ok: true; data: CommandResponse<T> } | { ok: false; error: CommandErrorCode }

export function commandMessage<T extends CommandType>(
  type: T,
  payload: CommandRequest<T>
): CommandMessage<T> {
  return { v: MESSAGE_VERSION, type, payload }
}

/** Structural check of the envelope only; payloads are validated per command. */
export function isCommandEnvelope(
  value: unknown
): value is { v: typeof MESSAGE_VERSION; type: string; payload: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.v === MESSAGE_VERSION &&
    typeof candidate.type === 'string' &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null
  )
}

function hasOnlyKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

const NO_PAYLOAD = (payload: object): payload is Record<string, never> => hasOnlyKeys(payload, [])

/** A session ticket: base64url, as `GateTicket` creates it. */
const TICKET_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

function isHandoff(value: unknown): value is GateHandoff {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    hasOnlyKeys(candidate, ['ticket', 'to']) &&
    typeof candidate.ticket === 'string' &&
    TICKET_PATTERN.test(candidate.ticket) &&
    isHttpUrl(candidate.to)
  )
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function isUrlPayload(payload: object): payload is { url: string } {
  return hasOnlyKeys(payload, ['url']) && isHttpUrl((payload as { url?: unknown }).url)
}

function isHttpUrl(text: unknown): text is string {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_COMMAND_URL_LENGTH) {
    return false
  }
  try {
    const { protocol } = new URL(text)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Per-command payload validation; a payload that fails is `message.malformed`. */
export const COMMAND_PAYLOAD_GUARDS: {
  [T in CommandType]: (payload: object) => payload is CommandRequest<T>
} = {
  'system.ping': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'decision.get': (payload): payload is { url: string } =>
    hasOnlyKeys(payload, ['url']) && isHttpUrl((payload as { url?: unknown }).url),
  'feedGuard.attach': (payload): payload is { url: string; attributes: GuardAttributes } =>
    hasOnlyKeys(payload, ['url', 'attributes']) &&
    isHttpUrl((payload as { url?: unknown }).url) &&
    isGuardAttributes((payload as { attributes?: unknown }).attributes),
  'stats.today': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'stats.week': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'privacy.incognitoAccess': (payload): payload is Record<string, never> =>
    hasOnlyKeys(payload, []),
  'gate.load': (payload): payload is { handoff: GateHandoff | null } => {
    const handoff = (payload as { handoff?: unknown }).handoff
    return hasOnlyKeys(payload, ['handoff']) && (handoff === null || isHandoff(handoff))
  },
  'gate.pauseDone': NO_PAYLOAD,
  'gate.commit': (payload): payload is { minutes: IntentionMinutes; intention: string } => {
    const { minutes, intention } = payload as { minutes?: unknown; intention?: unknown }
    return (
      hasOnlyKeys(payload, ['minutes', 'intention']) &&
      (INTENTION_MINUTES as readonly unknown[]).includes(minutes) &&
      isBoundedString(intention, MAX_INTENTION_LENGTH)
    )
  },
  'gate.close': NO_PAYLOAD,
  'gate.emergency': NO_PAYLOAD,
  'gate.emergencyDone': NO_PAYLOAD,
  'gate.emergencyCancel': NO_PAYLOAD,
  'gate.leave': NO_PAYLOAD,
  'gate.extend': NO_PAYLOAD,
  'gate.continue': NO_PAYLOAD,
  'gate.search': (payload): payload is { query: string } => {
    const { query } = payload as { query?: unknown }
    return (
      hasOnlyKeys(payload, ['query']) &&
      isBoundedString(query, MAX_GATE_SEARCH_LENGTH) &&
      query.trim().length > 0
    )
  },
  'gate.open': isUrlPayload,
  'intention.expired': isUrlPayload,
  'intention.leave': isUrlPayload,
  'intention.extend': isUrlPayload,
  'rules.state': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'rules.propose': (payload): payload is RuleChangeProposal => {
    const { ruleset, baseRevision } = payload as Partial<RuleChangeProposal>
    return (
      hasOnlyKeys(payload, ['ruleset', 'baseRevision']) &&
      typeof ruleset === 'object' &&
      ruleset !== null &&
      Number.isInteger(baseRevision)
    )
  },
  'rules.cancelPending': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'preferences.get': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'preferences.set': (payload): payload is PreferenceChange => isPreferenceChange(payload),
  'data.export': (payload): payload is { format: ExportFormat } =>
    hasOnlyKeys(payload, ['format']) &&
    (EXPORT_FORMATS as readonly unknown[]).includes((payload as { format?: unknown }).format),
  'data.deleteAll': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'intention.active': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'intention.end': (payload): payload is { targetGroup: string } => {
    const { targetGroup } = payload as { targetGroup?: unknown }
    return (
      hasOnlyKeys(payload, ['targetGroup']) &&
      typeof targetGroup === 'string' &&
      targetGroup.length > 0 &&
      targetGroup.length <= 128
    )
  },
  'intention.log': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
}

/**
 * Commands only the extension's own gate page may send: the sender must be
 * `chrome-extension://<this id or its dynamic id>/gate.html` as the top
 * frame of a tab, and the tab is the one the command acts on.
 */
export const GATE_PAGE_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  'gate.load',
  'gate.pauseDone',
  'gate.commit',
  'gate.close',
  'gate.emergency',
  'gate.emergencyDone',
  'gate.emergencyCancel',
  'gate.leave',
  'gate.extend',
  'gate.continue',
  'gate.search',
])

/**
 * Commands that change the user's rules, preferences or data (and the
 * intention reads that go with them): the router answers them only from the
 * extension's own pages (popup, options), never from a content script.
 */
export const EXTENSION_PAGE_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  'rules.state',
  'rules.propose',
  'rules.cancelPending',
  'preferences.get',
  'preferences.set',
  'data.export',
  'data.deleteAll',
  'intention.active',
  'intention.end',
  'intention.log',
])

/**
 * Commands sent by content scripts about the page they run in: the router
 * only answers them when the sending tab's URL has the same host as the URL
 * the payload asks about, so a frame cannot ask about another site.
 */
export const TAB_URL_COMMANDS: { [T in CommandType]?: (payload: CommandRequest<T>) => string } = {
  'decision.get': (payload) => payload.url,
  'feedGuard.attach': (payload) => payload.url,
  'gate.open': (payload) => payload.url,
  'intention.expired': (payload) => payload.url,
  'intention.leave': (payload) => payload.url,
  'intention.extend': (payload) => payload.url,
}

/**
 * Pushed by the service worker to the feed guards of open site tabs when a
 * decision may have changed (rule set edited, a schedule edge passed): each
 * guard asks again for its page.
 */
export const DECISION_CHANGED = 'decision.changed'

export interface DecisionChangedMessage {
  v: typeof MESSAGE_VERSION
  type: typeof DECISION_CHANGED
}

export function decisionChangedMessage(): DecisionChangedMessage {
  return { v: MESSAGE_VERSION, type: DECISION_CHANGED }
}

export function isDecisionChangedMessage(value: unknown): value is DecisionChangedMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return candidate.v === MESSAGE_VERSION && candidate.type === DECISION_CHANGED
}
