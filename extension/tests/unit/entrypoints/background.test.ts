// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { RULESET_KEY } from '../../../src/background/rules/RulesetStore'
import background from '../../../src/entrypoints/background'
import {
  commandMessage,
  type CommandMessage,
  type CommandResult,
  type CommandType,
} from '../../../src/shared/messages'

function send<T extends CommandType>(
  message: CommandMessage<T>,
  sender: Parameters<typeof fakeBrowser.runtime.onMessage.trigger>[1]
): Promise<CommandResult<T>> {
  return new Promise((resolve) => {
    void fakeBrowser.runtime.onMessage.trigger(message, sender, resolve)
  })
}

async function storedRuleset(): Promise<Ruleset | undefined> {
  return (await fakeBrowser.storage.local.get(RULESET_KEY))[RULESET_KEY] as Ruleset | undefined
}

describe('background entrypoint', () => {
  let updateEnabledRulesets: ReturnType<typeof vi.fn>
  let executeScript: ReturnType<typeof vi.fn>
  let sendMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fakeBrowser.reset()
    updateEnabledRulesets = vi.fn(() => Promise.resolve())
    fakeBrowser.declarativeNetRequest.updateEnabledRulesets =
      updateEnabledRulesets as typeof fakeBrowser.declarativeNetRequest.updateEnabledRulesets
    executeScript = vi.fn(() => Promise.resolve([]))
    fakeBrowser.scripting.executeScript =
      executeScript as unknown as typeof fakeBrowser.scripting.executeScript
    sendMessage = vi.fn(() => Promise.resolve(undefined))
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 4 }] as never)
    fakeBrowser.tabs.sendMessage = sendMessage as unknown as typeof fakeBrowser.tabs.sendMessage
  })

  it('background_registers_command_router_on_start', () => {
    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(false)

    background.main()

    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(true)
  })

  it('background_answers_a_ping_from_its_own_extension', async () => {
    background.main()

    const response = await send(commandMessage('system.ping', {}), { id: fakeBrowser.runtime.id })

    expect(response.ok).toBe(true)
  })

  it('background_rejects_a_ping_from_a_foreign_sender', async () => {
    background.main()

    const response = await send(commandMessage('system.ping', {}), { id: 'another-extension-id' })

    expect(response).toEqual({ ok: false, error: 'sender.rejected' })
  })

  it('install_pins_the_device_time_zone_into_the_starter_rule_set', async () => {
    background.main()

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' })

    await vi.waitFor(async () => {
      expect((await storedRuleset())?.timeZone).toBe(
        Intl.DateTimeFormat().resolvedOptions().timeZone
      )
    })
  })

  it('start_up_enables_the_shorts_redirect_for_the_starter_rule_set', async () => {
    background.main()

    await vi.waitFor(() => {
      expect(updateEnabledRulesets).toHaveBeenCalledWith({ enableRulesetIds: ['shorts-redirect'] })
    })
  })

  it('a_content_script_gets_the_feed_decision_of_its_page', async () => {
    background.main()

    const response = await send(
      commandMessage('decision.get', { url: 'https://www.reddit.com/' }),
      {
        id: fakeBrowser.runtime.id,
        tab: { url: 'https://www.reddit.com/', id: 1 } as never,
      }
    )

    expect(response.ok).toBe(true)
    if (response.ok) expect(response.data.surface).toBe('reddit.feed')
  })

  it('an_update_reinjects_the_feed_guard_into_open_site_tabs', async () => {
    background.main()

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '0.0.0' })

    await vi.waitFor(() => {
      expect(executeScript).toHaveBeenCalledWith({
        target: { tabId: 4 },
        files: ['/content-scripts/feed-guard.js'],
      })
    })
  })

  it('a_rule_set_change_tells_open_site_tabs_to_ask_again', async () => {
    background.main()
    await vi.waitFor(async () => {
      expect(await storedRuleset()).toBeDefined()
    })
    sendMessage.mockClear()

    const ruleset = (await storedRuleset()) as Ruleset
    await fakeBrowser.storage.local.set({ [RULESET_KEY]: { ...ruleset, rules: [] } })

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(4, { v: 1, type: 'decision.changed' })
    })
  })

  it('start_up_schedules_the_restriction_check_alarm', async () => {
    background.main()

    await vi.waitFor(async () => {
      expect(await fakeBrowser.alarms.get('decision.refresh')).toMatchObject({ periodInMinutes: 1 })
    })
  })
})
