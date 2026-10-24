// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import type { Clock } from '../../shared/clock'
import { feedSurfacesOfHost, pageSurfaceOf } from '../../shared/FeedSurfaces'
import type { FeedDecision } from '../../shared/messages'
import { SHORTS_SURFACE } from '../shorts/ShortsRedirectSync'
import type { CommandHandlers } from './CommandRouter'

/** The slice of `DecisionService` the feed command needs. */
export interface FeedDecisions {
  feedDecisionFor(url: string): Promise<FeedDecision>
}

/** The slice of `ShortsRedirectSync` the feed command feeds. */
export interface ShortsRedirectState {
  apply(enabled: boolean): Promise<void>
}

export interface CommandDependencies {
  clock: Clock
  catalog: RulesCatalog
  decisions: FeedDecisions
  shortsRedirect?: ShortsRedirectState
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
  shortsRedirect,
}: CommandDependencies): CommandHandlers {
  return {
    'system.ping': () => ({ at: clock.now() }),
    'decision.get': async ({ url }) => {
      const answer = await decisions.feedDecisionFor(url)
      // A YouTube page already knows whether Shorts are restricted right now:
      // keep the hard redirect in step without a separate decision.
      if (shortsRedirect && isShortsSite(url, catalog)) {
        await shortsRedirect.apply(answer.restrict.includes(SHORTS_SURFACE)).catch(() => undefined)
      }
      return answer
    },
  }
}
