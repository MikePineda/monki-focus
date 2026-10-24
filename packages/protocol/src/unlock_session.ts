// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Reference driver for the shared state-machine vectors
 * (`fixtures/state-machines/*.json`): trusted time plus replay ledger,
 * advanced one event at a time. Each event carries the device clock
 * (`wall`, `mono`, `boot`) and one action; the driver ratchets the floor
 * first (platforms do so at least every 60 s), applies the action and
 * reports the outcome. Kotlin, Swift and the extension port this driver and
 * must produce the same outcomes for every vector.
 */
import { formatRfc3339Utc, parseRfc3339Utc } from './rfc3339_utc.ts'
import {
  activate,
  applyRevocations,
  deactivate,
  emptyReplayLedger,
  purge,
  receive,
  revalidate,
  type ReplayEntry,
  type ReplayLedger,
  type ReplayStatus,
} from './replay_ledger.ts'
import type { Result, TokenErrorCode } from './token_error.ts'
import {
  applyTimeAnchor,
  initialTrustedTime,
  raiseFloorFromIat,
  ratchetFloor,
  trustedNow,
  type DeviceClock,
  type TrustedTimeState,
} from './trusted_time.ts'

export type SessionAction =
  | {
      readonly type: 'time_response'
      readonly srv: string
      readonly sentMono: number
      readonly revoked?: readonly { readonly jti: string; readonly exp: string }[]
      readonly complete?: boolean
    }
  | {
      readonly type: 'unlock_received'
      readonly jti: string
      readonly iat: string
      readonly nbf: string
      readonly exp: string
      readonly durS: number
    }
  | { readonly type: 'activate' | 'deactivate' | 'revalidate'; readonly jti: string }
  | { readonly type: 'purge' }
  | { readonly type: 'observe' }

export interface SessionEvent {
  /** Wall clock, RFC 3339 UTC. */
  readonly wall: string
  /** Monotonic clock, milliseconds. */
  readonly mono: number
  readonly boot: string
  readonly action: SessionAction
}

/** A stored ledger entry as the vectors write it (times RFC 3339 UTC, `null` when absent). */
export interface EntryView {
  readonly status: ReplayStatus
  readonly exp: string
  readonly stale: boolean
  readonly receipt: {
    readonly boot: string
    readonly monoAtMs: number
    readonly budgetMs: number
  } | null
  readonly activation: {
    readonly at: string
    readonly end: string
    readonly boot: string
    readonly monoAtMs: number
    readonly budgetMs: number
  } | null
}

/**
 * The full outcome of one event. Every field is always present (`null` when
 * it does not apply) and runners compare all of them.
 */
export interface SessionOutcome {
  readonly ok: boolean
  readonly error: TokenErrorCode | null
  /** `activate`: the unlock's end, RFC 3339 UTC. */
  readonly end: string | null
  /** Trusted now after the event, RFC 3339 UTC. */
  readonly trustedNow: string
  /** The persisted floor after the event, RFC 3339 UTC. */
  readonly floor: string
  /** The persisted `revocationsIncomplete` flag after the event. */
  readonly revocationsIncomplete: boolean
  /** Platform notices raised by the event (`time_floor_lowered`). */
  readonly notices: readonly string[]
  /** Status of the event's jti (`absent` when not stored; `null` for events without a jti). */
  readonly status: ReplayStatus | 'absent' | null
  /** The event's jti entry after the event (`null` when absent or no jti). */
  readonly entry: EntryView | null
  /** Every stored jti after the event, sorted. */
  readonly entries: readonly string[]
}

export interface SessionState {
  readonly time: TrustedTimeState
  readonly ledger: ReplayLedger
}

export function initialSession(floor = 0): SessionState {
  return { time: { ...initialTrustedTime, floor }, ledger: emptyReplayLedger }
}

function seconds(text: string): number {
  const value = parseRfc3339Utc(text)
  if (value === null) {
    throw new RangeError(`not an RFC 3339 UTC instant: ${text}`)
  }
  return value
}

function entryView(entry: ReplayEntry): EntryView {
  const { receipt, activation } = entry
  return {
    status: entry.status,
    exp: formatRfc3339Utc(entry.exp),
    stale: entry.stale === true,
    receipt:
      receipt === undefined
        ? null
        : { boot: receipt.boot, monoAtMs: receipt.monoAtMs, budgetMs: receipt.budgetMs },
    activation:
      activation === undefined
        ? null
        : {
            at: formatRfc3339Utc(activation.at),
            end: formatRfc3339Utc(activation.end),
            boot: activation.mono.boot,
            monoAtMs: activation.mono.monoAtMs,
            budgetMs: activation.mono.budgetMs,
          },
  }
}

export function applySessionEvent(
  state: SessionState,
  event: SessionEvent
): { readonly state: SessionState; readonly outcome: SessionOutcome } {
  const clock: DeviceClock = {
    wallNow: seconds(event.wall),
    monoNowMs: event.mono,
    boot: event.boot,
  }
  let time = ratchetFloor(state.time, clock)
  let ledger = state.ledger
  let result: Result<unknown> = { ok: true, value: null }
  let end: number | undefined
  const notices: string[] = []
  const { action } = event

  switch (action.type) {
    case 'time_response': {
      const complete = action.complete ?? true
      const anchored = applyTimeAnchor(time, seconds(action.srv), action.sentMono, clock, complete)
      result = anchored
      if (anchored.ok) {
        time = anchored.value.state
        if (anchored.value.floorLowered) notices.push('time_floor_lowered')
        const revoked = (action.revoked ?? []).map(({ jti, exp }) => ({ jti, exp: seconds(exp) }))
        ledger = applyRevocations(ledger, revoked, complete)
      }
      break
    }
    case 'unlock_received': {
      time = raiseFloorFromIat(time, seconds(action.iat), clock)
      const window = {
        jti: action.jti,
        iat: seconds(action.iat),
        nbf: seconds(action.nbf),
        exp: seconds(action.exp),
        durS: action.durS,
      }
      const received = receive(ledger, window, { time, clock })
      ledger = received.ledger
      result = received.result
      break
    }
    case 'activate': {
      const activated = activate(ledger, action.jti, { time, clock })
      ledger = activated.ledger
      result = activated.result
      if (activated.result.ok) end = activated.result.value
      break
    }
    case 'deactivate':
      ledger = deactivate(ledger, action.jti)
      break
    case 'revalidate': {
      const revalidated = revalidate(ledger, action.jti, { time, clock })
      ledger = revalidated.ledger
      result = revalidated.result
      break
    }
    case 'purge':
      ledger = purge(ledger, { time, clock })
      break
    case 'observe':
      break
  }

  const jti = 'jti' in action ? action.jti : undefined
  const stored = jti === undefined ? undefined : ledger.get(jti)
  const outcome: SessionOutcome = {
    ok: result.ok,
    error: result.ok ? null : result.error.code,
    end: end === undefined ? null : formatRfc3339Utc(end),
    trustedNow: formatRfc3339Utc(trustedNow(time, clock)),
    floor: formatRfc3339Utc(time.floor),
    revocationsIncomplete: time.revocationsIncomplete,
    notices,
    status: jti === undefined ? null : (stored?.status ?? 'absent'),
    entry: stored === undefined ? null : entryView(stored),
    entries: [...ledger.keys()].sort(),
  }
  return { state: { time, ledger }, outcome }
}
