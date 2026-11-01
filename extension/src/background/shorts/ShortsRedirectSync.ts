// SPDX-License-Identifier: AGPL-3.0-or-later
import { FACEBOOK_REELS_SURFACE } from '../../sites/facebook'
import { SHORTS_SURFACE } from '../../sites/youtube'

export { FACEBOOK_REELS_SURFACE, SHORTS_SURFACE }

/** The static DNR ruleset in `public/rules/shorts-redirect.json` (manifest id). */
export const SHORTS_REDIRECT_RULESET_ID = 'shorts-redirect'

/** A short-video surface and the static DNR ruleset that turns its hard loads into a single-video page. */
export interface ShortVideoRedirect {
  surface: string
  rulesetId: string
}

/** YouTube Shorts: `/shorts/<id>` -> `/watch?v=<id>`. */
export const YOUTUBE_SHORTS_REDIRECT: ShortVideoRedirect = {
  surface: SHORTS_SURFACE,
  rulesetId: SHORTS_REDIRECT_RULESET_ID,
}

/** Facebook Reels: `/reel/<id>` -> `/watch/?v=<id>` (`public/rules/facebook-reels-redirect.json`). */
export const FACEBOOK_REELS_REDIRECT: ShortVideoRedirect = {
  surface: FACEBOOK_REELS_SURFACE,
  rulesetId: 'facebook-reels-redirect',
}

/** The slice of `declarativeNetRequest` the sync uses. */
export interface RulesetToggle {
  updateEnabledRulesets(options: {
    enableRulesetIds?: string[]
    disableRulesetIds?: string[]
  }): Promise<void>
}

/** The slice of `DecisionService` the sync asks. */
export interface SurfaceRestriction {
  restricts(surface: string): Promise<boolean>
}

/**
 * Keeps the static `shorts-redirect` ruleset (a hard `/shorts/<id>` load
 * becomes `/watch?v=<id>`) enabled exactly while the rule set blocks or
 * hides the `youtube.shorts` surface. Runs at start-up, after every rule set
 * change and whenever a YouTube page asks for a decision, so schedules that
 * open or close are picked up on the next YouTube visit. Fails closed: when
 * the decision cannot be made the restriction counts, so the redirect stays on.
 * Updates run one after another (a promise chain), so two racing callers can
 * never leave the ruleset in the state of the older one. One instance per
 * short-video surface (`target`, YouTube Shorts by default; Facebook Reels).
 */
export class ShortsRedirectSync {
  private last: boolean | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly restriction: SurfaceRestriction,
    private readonly toggle: RulesetToggle,
    private readonly target: ShortVideoRedirect = YOUTUBE_SHORTS_REDIRECT
  ) {}

  /** Asks the decision service and applies the answer. */
  async sync(): Promise<boolean> {
    const enabled = await this.restriction.restricts(this.target.surface).catch(() => true)
    await this.apply(enabled)
    return enabled
  }

  /**
   * Applies a restriction already known (a YouTube feed decision carries
   * it); only calls the browser when the state changes.
   */
  apply(enabled: boolean): Promise<void> {
    const run = this.queue.then(async () => {
      if (enabled === this.last) return
      await this.toggle.updateEnabledRulesets(
        enabled
          ? { enableRulesetIds: [this.target.rulesetId] }
          : { disableRulesetIds: [this.target.rulesetId] }
      )
      this.last = enabled
    })
    // A failed update must not block the ones queued after it.
    this.queue = run.catch(() => undefined)
    return run
  }
}
