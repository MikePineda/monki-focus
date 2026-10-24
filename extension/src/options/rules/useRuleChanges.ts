// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { CommandClient } from '../../shared/CommandClient'
import {
  configuredRuleset,
  type RuleChangeRejection,
  type RulesState,
} from '../../shared/RuleChangeContract'
import { validateRuleset } from '../../shared/RulesetValidation'
import { requiredOrigins, type PermissionsApi } from '../../shared/SiteOrigins'

/** What the last save did, for the feedback line. */
export type SaveFeedback =
  | { kind: 'applied' }
  | { kind: 'pending'; effectiveFrom: string }
  | { kind: 'cancelled' }
  | { kind: 'rejected'; code: RuleChangeRejection | 'failed' }

export interface RuleChanges {
  state: RulesState | null
  loadFailed: boolean
  feedback: SaveFeedback | null
  /** Validates, asks for any new site access, then sends the whole set. */
  propose: (next: Ruleset) => Promise<boolean>
  cancelPending: () => Promise<void>
}

/**
 * The options page side of rule editing: the state from `rules.state`, and
 * every save through `rules.propose`, where the service worker applies the
 * engine's rule-change policy. Nothing here decides what tightens.
 */
export function useRuleChanges(client: CommandClient, permissions: PermissionsApi): RuleChanges {
  const [state, setState] = useState<RulesState | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null)

  const reload = useCallback(async () => {
    try {
      setState(await client.send('rules.state', {}))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [client])

  useEffect(() => {
    void reload()
  }, [reload])

  const propose = useCallback(
    async (next: Ruleset): Promise<boolean> => {
      if (state === null) return false
      const base = configuredRuleset(state)
      const verdict = validateRuleset({ ...next, revision: base.revision + 1 })
      if (!verdict.valid) {
        setFeedback({ kind: 'rejected', code: verdict.code })
        return false
      }
      // Asked first, while the click still counts as the user's gesture.
      const known = new Set(requiredOrigins(base))
      const added = requiredOrigins(next).filter((origin) => !known.has(origin))
      if (added.length > 0) await permissions.request({ origins: added }).catch(() => false)
      try {
        const outcome = await client.send('rules.propose', {
          ruleset: next,
          baseRevision: base.revision,
        })
        if (outcome.status === 'rejected') {
          setFeedback({ kind: 'rejected', code: outcome.code })
          if (outcome.code === 'stale_revision') await reload()
          return false
        }
        setState(outcome.state)
        setFeedback(
          outcome.status === 'applied'
            ? { kind: 'applied' }
            : { kind: 'pending', effectiveFrom: outcome.effectiveFrom }
        )
        return true
      } catch {
        setFeedback({ kind: 'rejected', code: 'failed' })
        return false
      }
    },
    [client, permissions, reload, state]
  )

  const cancelPending = useCallback(async () => {
    try {
      setState(await client.send('rules.cancelPending', {}))
      setFeedback({ kind: 'cancelled' })
    } catch {
      setFeedback({ kind: 'rejected', code: 'failed' })
    }
  }, [client])

  return { state, loadFailed, feedback, propose, cancelPending }
}
