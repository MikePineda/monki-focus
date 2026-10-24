// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, screen, waitFor, within } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import type { Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { PreferenceService } from '../../../src/background/preferences/PreferenceService'
import {
  PENDING_RULESET_KEY,
  PendingRuleChangeStore,
} from '../../../src/background/rules/PendingRuleChangeStore'
import { RuleChangeService } from '../../../src/background/rules/RuleChangeService'
import { RULESET_KEY, RulesetStore } from '../../../src/background/rules/RulesetStore'
import en from '../../../src/i18n/catalogs/en.json'
import { formatInstantIn } from '../../../src/i18n/formatTime'
import { OptionsApp } from '../../../src/options/OptionsApp'
import { bundledRulesCatalog } from '../../../src/shared/bundledRulesCatalog'
import type { WeekStats } from '../../../src/shared/StatsContract'
import { makeRuleset } from '../../factories/makeRuleset'
import { fakePermissions, handlerClient } from '../../support/fakeCommandClient'
import { ManualClock } from '../../support/ManualClock'
import { renderWithI18n } from '../../support/renderWithI18n'

const WEEK: WeekStats = {
  days: Array.from({ length: 7 }, (_value, index) => ({
    date: `2026-10-2${index + 1}`,
    pulse: index === 6 ? 64 : null,
    totalSeconds: index === 6 ? 3600 : 0,
  })),
  weeks: 4,
  hourly: [{ weekday: 1, hour: 9, averageSeconds: 600, pulse: 85 }],
}

async function storedEffective(): Promise<Ruleset> {
  return (await fakeBrowser.storage.local.get(RULESET_KEY))[RULESET_KEY] as Ruleset
}

async function renderOptions(hash = '#rules') {
  await fakeBrowser.storage.local.set({ [RULESET_KEY]: makeRuleset() })
  const rules = new RuleChangeService({
    rulesets: new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone: () => 'UTC' }),
    pending: new PendingRuleChangeStore(fakeBrowser.storage.local),
    catalog: bundledRulesCatalog(),
    clock: new ManualClock('2026-10-27T10:00:00Z'),
  })
  const preferences = new PreferenceService(fakeBrowser.storage.local)
  const deleteAll = vi.fn(() => ({ stores: ['blocks', 'events', 'outbox'] }))
  const exportData = vi.fn(({ format }: { format: string }) => ({
    fileName: `export.${format}`,
    mimeType: 'text/plain',
    text: 'data',
  }))
  const { client } = handlerClient({
    'rules.state': () => rules.state(),
    'rules.propose': (proposal) => rules.propose(proposal),
    'rules.cancelPending': () => rules.cancelPending(),
    'preferences.get': () => preferences.get(),
    'preferences.set': (change) => preferences.set(change),
    'stats.week': () => WEEK,
    'intention.log': () => ({ available: false, entries: [] }),
    'data.export': exportData,
    'data.deleteAll': deleteAll,
  })
  const download = vi.fn()
  const permissions = fakePermissions()
  renderWithI18n(
    <OptionsApp
      client={client}
      permissions={permissions}
      download={download}
      version="0.1.0"
      initialHash={hash}
    />
  )
  return { deleteAll, exportData, download, permissions }
}

async function editExampleBudget(minutes: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit example.com' }))
  const editor = screen.getByRole('form', { name: 'Edit the rule for example.com' })
  const budget = within(editor).getByLabelText(en['rules.editor.budget'])
  await userEvent.clear(budget)
  await userEvent.type(budget, minutes)
  await userEvent.click(within(editor).getByRole('button', { name: en['rules.editor.save'] }))
}

describe('options: rules', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('lists_each_rule_with_target_mode_schedule_and_budget', async () => {
    await renderOptions()

    const table = await screen.findByRole('table', { name: en['rules.sites.title'] })
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
      'example.comPause firstAlways30In force'
    )
  })

  it('tightening_a_rule_applies_immediately', async () => {
    await renderOptions()

    await editExampleBudget('15')

    expect(await screen.findByText(en['rules.feedback.applied'])).toBeInTheDocument()
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(15)
    expect(screen.queryByText(en['rules.pending.cancel'])).toBeNull()
  })

  it('loosening_a_rule_shows_pending_until_effective_and_can_be_cancelled', async () => {
    await renderOptions()

    await editExampleBudget('60')

    const when = formatInstantIn('2026-10-27T22:00:00Z', 'Etc/GMT-2', 'en')
    expect(
      await screen.findByText(en['rules.feedback.pending'].replace('{time}', when))
    ).toBeInTheDocument()
    expect(screen.getByText('Rule changed for example.com')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: en['rules.sites.title'] })).toHaveTextContent(
      'example.comPause firstAlways60Waiting'
    )
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(30)

    await userEvent.click(screen.getByRole('button', { name: en['rules.pending.cancel'] }))

    expect(await screen.findByText(en['rules.feedback.cancelled'])).toBeInTheDocument()
    expect(await fakeBrowser.storage.local.get(PENDING_RULESET_KEY)).toEqual({})
    expect(screen.getByRole('table', { name: en['rules.sites.title'] })).toHaveTextContent(
      'example.com' + 'Pause firstAlways30In force'
    )
  })

  it('allowing_a_subreddit_adds_an_allow_rule_that_waits', async () => {
    await renderOptions()

    await userEvent.type(await screen.findByLabelText(en['rules.subreddits.add']), 'r/AskScience')
    await userEvent.click(screen.getByRole('button', { name: en['rules.subreddits.allow'] }))

    expect(await screen.findByText('r/AskScience · Waiting')).toBeInTheDocument()
    const pending = (await fakeBrowser.storage.local.get(PENDING_RULESET_KEY))[
      PENDING_RULESET_KEY
    ] as { ruleset: Ruleset }
    expect(pending.ruleset.rules).toContainEqual({
      id: 'allow-reddit-r-askscience',
      target: { kind: 'site', domain: 'reddit.com', path: '/r/AskScience/**' },
      mode: 'allow',
      schedules: [],
      enabled: true,
    })
  })

  it('adding_a_blocked_site_asks_for_its_access_and_applies_now', async () => {
    const { permissions } = await renderOptions()

    await userEvent.type(
      (await screen.findAllByLabelText(en['rules.sites.domain']))[0] as HTMLElement,
      'https://www.Video.example/x'
    )
    await userEvent.selectOptions(
      screen.getAllByLabelText(en['rules.editor.mode']).at(-1) as HTMLElement,
      'block'
    )
    await userEvent.click(screen.getByRole('button', { name: en['rules.sites.add'] }))

    expect(await screen.findByText(en['rules.feedback.applied'])).toBeInTheDocument()
    expect(permissions.request).toHaveBeenCalledWith({ origins: ['*://*.video.example/*'] })
    expect((await storedEffective()).rules.map((rule) => rule.id)).toContain('site-video-example')
  })

  it('a_site_address_that_cannot_be_ruled_saves_nothing', async () => {
    await renderOptions()

    await userEvent.type(
      (await screen.findAllByLabelText(en['rules.sites.domain']))[0] as HTMLElement,
      'not a domain'
    )
    await userEvent.click(screen.getByRole('button', { name: en['rules.sites.add'] }))

    expect(screen.getAllByLabelText(en['rules.sites.domain'])[0]).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect((await storedEffective()).rules).toHaveLength(1)
  })

  it('an_invalid_import_is_refused_with_a_neutral_reason', async () => {
    await renderOptions()
    const picker = await screen.findByTestId('ruleset-import')

    fireEvent.change(picker, { target: { files: [new File(['{ nope'], 'rules.json')] } })

    expect(await screen.findByText(en['rules.rejected.invalid_json'])).toBeInTheDocument()
  })

  it('a_looser_import_waits_like_any_other_change', async () => {
    await renderOptions()
    const looser = makeRuleset({ rules: [] })
    const picker = await screen.findByTestId('ruleset-import')

    fireEvent.change(picker, {
      target: { files: [new File([JSON.stringify(looser)], 'rules.json')] },
    })

    expect(await screen.findByText('Rule removed for example.com')).toBeInTheDocument()
    expect((await storedEffective()).rules).toHaveLength(1)
  })

  it('bedtime_turned_off_waits_until_the_change_takes_effect', async () => {
    await renderOptions()

    await userEvent.click(
      await screen.findByRole('checkbox', { name: en['rules.bedtime.enabled'] })
    )
    await userEvent.click(screen.getByRole('button', { name: en['rules.bedtime.save'] }))

    expect(await screen.findByText(en['rules.pending.bedtime'])).toBeInTheDocument()
    expect((await storedEffective()).bedtime.enabled).toBe(true)
  })
})

describe('options: preferences', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('language_theme_and_tracking_choices_are_saved', async () => {
    await renderOptions('#preferences')

    await userEvent.selectOptions(await screen.findByLabelText(en['preferences.language']), 'es')
    await userEvent.selectOptions(screen.getByLabelText(en['preferences.theme']), 'dark')
    await userEvent.click(screen.getByRole('checkbox', { name: en['preferences.storeTitles'] }))

    await waitFor(async () =>
      expect(
        await fakeBrowser.storage.local.get(['ui.language', 'ui.theme', 'privacy.storeTitles'])
      ).toEqual({ 'ui.language': 'es', 'ui.theme': 'dark', 'privacy.storeTitles': true })
    )
  })

  it('store_titles_is_off_by_default_and_explained', async () => {
    await renderOptions('#preferences')

    const checkbox = await screen.findByRole('checkbox', { name: en['preferences.storeTitles'] })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAccessibleDescription(en['preferences.storeTitles.description'])
  })
})

describe('options: stats', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('every_chart_has_a_table_view', async () => {
    await renderOptions('#stats')

    for (const title of [en['stats.pulse.title'], en['stats.heatmap.title']]) {
      const group = await screen.findByRole('radiogroup', { name: `Show ${title} as` })
      await userEvent.click(within(group).getByRole('radio', { name: en['chartTable.table'] }))
      expect(screen.getByRole('table', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('table', { name: en['stats.heatmap.title'] })).toHaveTextContent('85')
  })

  it('delete_all_local_data_requires_confirmation', async () => {
    const { deleteAll } = await renderOptions('#stats')

    await userEvent.click(await screen.findByRole('button', { name: en['stats.data.delete'] }))
    expect(deleteAll).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: en['stats.data.cancel'] })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: en['stats.data.cancel'] }))
    expect(screen.queryByText(en['stats.data.confirmTitle'])).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: en['stats.data.delete'] }))
    await userEvent.click(screen.getByRole('button', { name: en['stats.data.confirmDelete'] }))

    expect(deleteAll).toHaveBeenCalledOnce()
    expect(await screen.findByText(en['stats.data.deleted'])).toBeInTheDocument()
  })

  it('exports_in_activitywatch_and_csv_formats', async () => {
    const { download } = await renderOptions('#stats')

    await userEvent.click(
      await screen.findByRole('button', { name: en['stats.data.exportActivityWatch'] })
    )
    await userEvent.click(screen.getByRole('button', { name: en['stats.data.exportCsv'] }))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(2))
    expect(download.mock.calls.map(([file]) => (file as { fileName: string }).fileName)).toEqual([
      'export.activitywatch',
      'export.csv',
    ])
  })
})

describe('options: navigation and about', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('the_nav_marks_the_current_section_and_links_to_the_others', async () => {
    await renderOptions('#about')

    const nav = screen.getByRole('navigation', { name: en['options.nav'] })
    expect(within(nav).getByRole('link', { name: en['options.section.about'] })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(nav).getByRole('link', { name: en['options.section.stats'] })).toHaveAttribute(
      'href',
      '#stats'
    )
    expect(screen.getByText('Version 0.1.0')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en['about.source'] })).toHaveAttribute(
      'href',
      'https://github.com/MikePineda/monki-focus'
    )
  })
})
