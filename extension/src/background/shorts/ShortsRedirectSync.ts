// SPDX-License-Identifier: AGPL-3.0-or-later
import { SHORTS_SURFACE } from '../../sites/youtube'

export { SHORTS_SURFACE }

/** The static DNR ruleset in `public/rules/shorts-redirect.json` (manifest id). */
export const SHORTS_REDIRECT_RULESET_ID = 'shorts-redirect'

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
 * never leave the ruleset in the state of the older one.
 */
export class ShortsRedirectSync {
  private last: boolean | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly restriction: SurfaceRestriction,
    private readonly toggle: RulesetToggle
  ) {}

  /** Asks the decision service and applies the answer. */
  async sync(): Promise<boolean> {
    const enabled = await this.restriction.restricts(SHORTS_SURFACE).catch(() => true)
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
          ? { enableRulesetIds: [SHORTS_REDIRECT_RULESET_ID] }
          : { disableRulesetIds: [SHORTS_REDIRECT_RULESET_ID] }
      )
      this.last = enabled
    })
    // A failed update must not block the ones queued after it.
    this.queue = run.catch(() => undefined)
    return run
  }
}
