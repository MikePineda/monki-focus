// SPDX-License-Identifier: AGPL-3.0-or-later
import { surfaceRegistry } from '@monki-focus/rules/pure'
import { describe, expect, it, vi } from 'vitest'
import {
  SHORTS_REDIRECT_RULESET_ID,
  SHORTS_SURFACE,
  ShortsRedirectSync,
} from '../../../../src/background/shorts/ShortsRedirectSync'
import { STATIC_RULESETS } from '../../../../config/extensionManifest'

function makeSync(restricts: () => Promise<boolean>) {
  const updateEnabledRulesets = vi.fn(() => Promise.resolve())
  const sync = new ShortsRedirectSync({ restricts: vi.fn(restricts) }, { updateEnabledRulesets })
  return { sync, updateEnabledRulesets }
}

describe('ShortsRedirectSync', () => {
  it('ruleset_and_surface_ids_are_real', () => {
    expect(STATIC_RULESETS.map((ruleset) => ruleset.id)).toContain(SHORTS_REDIRECT_RULESET_ID)
    expect(surfaceRegistry.surfaces.map((surface) => surface.id)).toContain(SHORTS_SURFACE)
  })

  it('restricted_shorts_enable_the_redirect', async () => {
    const { sync, updateEnabledRulesets } = makeSync(() => Promise.resolve(true))

    expect(await sync.sync()).toBe(true)
    expect(updateEnabledRulesets).toHaveBeenCalledWith({ enableRulesetIds: ['shorts-redirect'] })
  })

  it('allowed_shorts_disable_the_redirect', async () => {
    const { sync, updateEnabledRulesets } = makeSync(() => Promise.resolve(false))

    expect(await sync.sync()).toBe(false)
    expect(updateEnabledRulesets).toHaveBeenCalledWith({ disableRulesetIds: ['shorts-redirect'] })
  })

  it('a_failed_decision_keeps_the_redirect_on', async () => {
    const { sync, updateEnabledRulesets } = makeSync(() => Promise.reject(new Error('engine')))

    expect(await sync.sync()).toBe(true)
    expect(updateEnabledRulesets).toHaveBeenCalledWith({ enableRulesetIds: ['shorts-redirect'] })
  })

  it('an_unchanged_state_does_not_call_the_browser_again', async () => {
    const { sync, updateEnabledRulesets } = makeSync(() => Promise.resolve(true))

    await sync.sync()
    await sync.apply(true)
    await sync.apply(false)
    await sync.apply(false)

    expect(updateEnabledRulesets).toHaveBeenCalledTimes(2)
  })

  it('a_failed_toggle_is_retried_next_time', async () => {
    const updateEnabledRulesets = vi
      .fn()
      .mockRejectedValueOnce(new Error('dnr'))
      .mockResolvedValue(undefined)
    const sync = new ShortsRedirectSync(
      { restricts: () => Promise.resolve(true) },
      { updateEnabledRulesets }
    )

    await expect(sync.apply(true)).rejects.toThrow('dnr')
    await sync.apply(true)

    expect(updateEnabledRulesets).toHaveBeenCalledTimes(2)
  })

  it('racing_updates_run_in_order_so_the_newest_state_wins', async () => {
    const calls: string[] = []
    let releaseFirst: () => void = () => undefined
    const updateEnabledRulesets = vi.fn(
      (options: { enableRulesetIds?: string[]; disableRulesetIds?: string[] }) => {
        const label = options.enableRulesetIds ? 'enable' : 'disable'
        calls.push(`start ${label}`)
        if (label === 'enable') {
          return new Promise<void>((resolve) => {
            releaseFirst = () => {
              calls.push('end enable')
              resolve()
            }
          })
        }
        calls.push(`end ${label}`)
        return Promise.resolve()
      }
    )
    const sync = new ShortsRedirectSync(
      { restricts: () => Promise.resolve(true) },
      { updateEnabledRulesets }
    )

    const first = sync.apply(true)
    const second = sync.apply(false)
    await Promise.resolve()
    releaseFirst()
    await Promise.all([first, second])

    expect(calls).toEqual(['start enable', 'end enable', 'start disable', 'end disable'])
  })
})
