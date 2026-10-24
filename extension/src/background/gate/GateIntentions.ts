// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf, instantOf, utcInstantOf } from '@monki-focus/engine'
import type { EscalationState, Ruleset } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import type {
  ActiveIntention,
  IntentionCommands,
  IntentionLogEntry,
  IntentionOutcome,
} from '../../shared/IntentionContract'
import type { IntentionEntry, IntentionEntryKind } from '../storage/db'
import type { IntentionNote } from './IntentionNotes'

/** How far back the Stats page's intentions log reaches. */
export const INTENTION_LOG_DAYS = 7
const DAY_SECONDS = 86_400

/** Log kinds that end an intention (or a visit) and how the log names them. */
const OUTCOMES: Partial<Record<IntentionEntryKind, IntentionOutcome>> = {
  kept: 'on_time',
  broken: 'broken',
  closed: 'closed',
}

export interface GateIntentionsDependencies {
  clock: Clock
  rulesets: { load(): Promise<Ruleset> }
  escalation: { all(): Promise<EscalationState[]> }
  notes: { of(group: string): Promise<IntentionNote | null> }
  log: () => Promise<{ between(from: string, to: string): Promise<IntentionEntry[]> }>
  endEarly: (group: string) => Promise<boolean>
}

/** The site a group stands for: its rule's domain, never a URL. */
function siteOf(group: string, ruleset: Ruleset | null): string | null {
  const rule = ruleset?.rules.find((candidate) => candidate.id === group)
  return rule?.target.kind === 'site' ? rule.target.domain : null
}

/**
 * The intention gate's side of the popup and the Stats page
 * (`IntentionCommands`): the running intention from the escalation state
 * and the session's notes, "End now" through the controller (the engine's
 * own transitions), and the last days' outcomes from the intention log.
 * The log holds no text, so its entries never carry the intention's words.
 */
export class GateIntentions implements IntentionCommands {
  constructor(private readonly deps: GateIntentionsDependencies) {}

  async active(): Promise<ActiveIntention | null> {
    const nowMs = this.deps.clock.now()
    const running = (await this.deps.escalation.all())
      .filter((state) => state.phase === 'active' && state.intentionExpiresAt !== null)
      .map((state) => ({
        group: state.targetGroup,
        expiresAt: epochSecondsOf(state.intentionExpiresAt as string) * 1000,
      }))
      .filter((state) => state.expiresAt > nowMs)
      .sort((a, b) => a.expiresAt - b.expiresAt)
    const first = running[0]
    if (!first) return null
    const [note, ruleset] = await Promise.all([
      this.deps.notes.of(first.group),
      this.deps.rulesets.load().catch(() => null),
    ])
    return {
      targetGroup: first.group,
      site: siteOf(first.group, ruleset),
      text: note?.text ? note.text : null,
      expiresAt: first.expiresAt,
    }
  }

  end(targetGroup: string): Promise<boolean> {
    return this.deps.endEarly(targetGroup)
  }

  async log(): Promise<IntentionLogEntry[]> {
    const nowSeconds = epochSecondsOf(instantOf(this.deps.clock.now()))
    const [entries, ruleset] = await Promise.all([
      (await this.deps.log()).between(
        utcInstantOf(nowSeconds - INTENTION_LOG_DAYS * DAY_SECONDS),
        utcInstantOf(nowSeconds + 1)
      ),
      this.deps.rulesets.load().catch(() => null),
    ])
    return entries
      .flatMap((entry) => {
        const outcome = OUTCOMES[entry.kind]
        if (!outcome) return []
        return [
          {
            at: epochSecondsOf(entry.at) * 1000,
            site: siteOf(entry.group, ruleset),
            text: null,
            minutes: null,
            outcome,
          },
        ]
      })
      .reverse()
  }
}
