// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import type { Clock } from '../../shared/clock'
import { feedSurfacesOfHost, pageSurfaceOf } from '../../shared/FeedSurfaces'
import type { GuardAttributes } from '../../shared/GuardAttributes'
import type { Decision } from '@monki-focus/rules/pure'
import type { ActiveSession } from '../../shared/GateContract'
import type { FeedDecision } from '../../shared/messages'
import type { GateCommands } from '../gate/GateCommands'
import type { IntentionCommands } from '../../shared/IntentionContract'
import type { DeletedLocalData, ExportedFile, ExportFormat } from '../../shared/LocalDataContract'
import type { PreferenceChange, Preferences } from '../../shared/PreferenceContract'
import type {
  RuleChangeOutcome,
  RuleChangeProposal,
  RulesState,
} from '../../shared/RuleChangeContract'
import { SHORTS_SURFACE } from '../shorts/ShortsRedirectSync'
import type { TrackingCommands } from '../tracking/TrackingModule'
import type { CommandHandlers } from './CommandRouter'

/** The slice of `DecisionService` the feed command needs. */
export interface FeedDecisions {
  feedDecisionFor(url: string): Promise<FeedDecision>
}

/** The slice of `ShortsRedirectSync` the feed command feeds. */
export interface ShortsRedirectState {
  apply(enabled: boolean): Promise<void>
}

/** The slice of `UserStylesheetInjector` the attach command uses. */
export interface FeedStylesheets {
  inject(tabId: number, tabUrl: string, attributes: GuardAttributes): Promise<boolean>
}

/** The slice of `RuleChangeService` the options page reaches. */
export interface RuleChanges {
  state(): Promise<RulesState>
  propose(proposal: RuleChangeProposal): Promise<RuleChangeOutcome>
  cancelPending(): Promise<RulesState>
}

/** The slice of `PreferenceService` the pages reach. */
export interface PreferenceCommands {
  get(): Promise<Preferences>
  set(change: PreferenceChange): Promise<Preferences>
}

/** The slice of `LocalDataService` the Stats page reaches. */
export interface LocalDataCommands {
  export(format: ExportFormat): Promise<ExportedFile>
  deleteAll(): Promise<DeletedLocalData>
}

/** The intention gate's command side (E6) plus the session a page is inside. */
export interface GateCommandDependencies {
  commands: GateCommands
  sessionFor(url: string, decision: Decision): Promise<ActiveSession | undefined>
}

export interface CommandDependencies {
  clock: Clock
  catalog: RulesCatalog
  decisions: FeedDecisions
  stylesheets?: FeedStylesheets
  shortsRedirect?: ShortsRedirectState
  tracking: TrackingCommands
  gate?: GateCommandDependencies
  rules?: RuleChanges
  preferences?: PreferenceCommands
  localData?: LocalDataCommands
  /** Plugged in by the intention gate (E6); without it intentions are unavailable. */
  intentions?: IntentionCommands
}

function wired<T>(dependency: T | undefined): T {
  if (dependency === undefined) throw new Error('command dependency not wired')
  return dependency
}

function isShortsSite(url: string, catalog: RulesCatalog): boolean {
  try {
    return feedSurfacesOfHost(pageSurfaceOf(url, catalog).host, catalog).includes(SHORTS_SURFACE)
  } catch {
    return false
  }
}

/** The service worker's command table; one handler per `CommandMap` entry. */
export function createCommandHandlers({
  clock,
  catalog,
  decisions,
  stylesheets,
  shortsRedirect,
  tracking,
  gate,
  rules,
  preferences,
  localData,
  intentions,
}: CommandDependencies): CommandHandlers {
  // Without the gate (unit tests of the other commands) its commands fail.
  const gateCommands = (): GateCommands => {
    if (!gate) throw new Error('gate.unavailable')
    return gate.commands
  }
  return {
    'system.ping': () => ({ at: clock.now() }),
    'decision.get': async ({ url }) => {
      const answer = await decisions.feedDecisionFor(url)
      // A YouTube page already knows whether Shorts are restricted right now:
      // keep the hard redirect in step without a separate decision.
      if (shortsRedirect && isShortsSite(url, catalog)) {
        await shortsRedirect.apply(answer.restrict.includes(SHORTS_SURFACE)).catch(() => undefined)
      }
      const session = await gate?.sessionFor(url, answer.decision).catch(() => undefined)
      return session ? { ...answer, session } : answer
    },
    'feedGuard.attach': async ({ attributes }, sender) => {
      // Top frame of a tab only; the router has checked the tab's host.
      const tabId = sender.tab?.id
      const tabUrl = sender.tab?.url
      if (!stylesheets || typeof tabId !== 'number' || !tabUrl || sender.frameId !== 0) {
        return { injected: false }
      }
      return { injected: await stylesheets.inject(tabId, tabUrl, attributes) }
    },
    'stats.today': () => tracking.today(),
    'stats.week': () => tracking.week(),
    'privacy.incognitoAccess': () => tracking.incognitoAccess(),
    'gate.load': ({ handoff }, sender) => gateCommands().load(handoff, sender),
    'gate.pauseDone': (_payload, sender) => gateCommands().pauseDone(sender),
    'gate.commit': ({ minutes, intention }, sender) =>
      gateCommands().commit(minutes, intention, sender),
    'gate.close': (_payload, sender) => gateCommands().close(sender),
    'gate.emergency': (_payload, sender) => gateCommands().emergency(sender),
    'gate.emergencyDone': (_payload, sender) => gateCommands().emergencyDone(sender),
    'gate.emergencyCancel': (_payload, sender) => gateCommands().emergencyCancel(sender),
    'gate.leave': (_payload, sender) => gateCommands().leave(sender),
    'gate.extend': (_payload, sender) => gateCommands().extend(sender),
    'gate.continue': (_payload, sender) => gateCommands().continueThroughError(sender),
    'gate.search': ({ query }, sender) => gateCommands().search(query, sender),
    'gate.open': ({ url }, sender) => gateCommands().open(url, sender),
    'intention.expired': ({ url }, sender) => gateCommands().expired(url, sender),
    'intention.leave': ({ url }, sender) => gateCommands().leaveFromPage(url, sender),
    'intention.extend': ({ url }, sender) => gateCommands().extendFromPage(url, sender),
    'rules.state': () => wired(rules).state(),
    'rules.propose': (proposal) => wired(rules).propose(proposal),
    'rules.cancelPending': () => wired(rules).cancelPending(),
    'preferences.get': () => wired(preferences).get(),
    'preferences.set': (change) => wired(preferences).set(change),
    'data.export': ({ format }) => wired(localData).export(format),
    'data.deleteAll': () => wired(localData).deleteAll(),
    'intention.active': async () =>
      intentions
        ? { available: true, active: await intentions.active() }
        : { available: false, active: null },
    'intention.end': async ({ targetGroup }) => ({
      ended: intentions ? await intentions.end(targetGroup) : false,
    }),
    'intention.log': async () =>
      intentions
        ? { available: true, entries: await intentions.log() }
        : { available: false, entries: [] },
  }
}
