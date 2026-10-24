// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen, waitFor, within } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SITE_HOST_PERMISSIONS } from '../../../config/extensionManifest'
import en from '../../../src/i18n/catalogs/en.json'
import { PopupApp } from '../../../src/popup/PopupApp'
import { popupViewModel } from '../../../src/popup/PopupViewModel'
import { fixedClock } from '../../../src/shared/clock'
import type { Preferences } from '../../../src/shared/PreferenceContract'
import type { TodayStats } from '../../../src/shared/StatsContract'
import { fakePermissions, handlerClient } from '../../support/fakeCommandClient'
import { renderWithI18n } from '../../support/renderWithI18n'

const EMPTY_DAY: TodayStats = {
  date: '2026-10-27',
  pulse: null,
  totalSeconds: 0,
  levels: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  uncategorisedSeconds: 0,
  topActivities: [],
  intentions: { total: 0, kept: 0, broken: 0, closes: 0 },
}

const BUSY_DAY: TodayStats = {
  ...EMPTY_DAY,
  pulse: 42,
  totalSeconds: 4 * 3600 + 12 * 60,
  levels: { 0: 3600, 1: 600, 2: 1200, 3: 1800, 4: 7920 },
  topActivities: [
    { activityKey: 'news.example', seconds: 3600, level: 0 },
    { activityKey: 'docs.example', seconds: 1800, level: 4 },
  ],
  intentions: { total: 4, kept: 2, broken: 1, closes: 3 },
}

const PREFERENCES: Preferences = {
  theme: 'system',
  language: 'system',
  storeTitles: false,
  countAudibleWhileIdle: true,
  chartViews: { todayLevels: 'chart', weekPulse: 'chart', weekHeatmap: 'chart' },
}

function renderPopup({
  today = BUSY_DAY,
  incognito = true,
  intention = false,
  granted = [...SITE_HOST_PERMISSIONS],
  chartViews = PREFERENCES.chartViews,
}: {
  today?: TodayStats
  incognito?: boolean
  intention?: boolean
  granted?: string[]
  chartViews?: Preferences['chartViews']
} = {}) {
  const end = vi.fn(() => ({ ended: true }))
  const set = vi.fn(() => PREFERENCES)
  const { client } = handlerClient({
    'stats.today': () => today,
    'privacy.incognitoAccess': () => ({ allowed: incognito }),
    'preferences.get': () => ({ ...PREFERENCES, chartViews }),
    'preferences.set': set,
    ...(intention
      ? {
          'intention.active': () => ({
            available: true,
            active: {
              targetGroup: 'starter-reddit-friction',
              site: 'reddit.com',
              text: 'Read one answer',
              expiresAt: Date.parse('2026-10-27T10:04:05Z'),
            },
          }),
          'intention.end': end,
        }
      : {}),
  })
  const permissions = fakePermissions(granted)
  const openOptions = vi.fn()
  renderWithI18n(
    <PopupApp
      client={client}
      permissions={permissions}
      clock={fixedClock('2026-10-27T10:00:00Z')}
      openOptions={openOptions}
      openExtensionSettings={vi.fn()}
    />
  )
  return { end, set, permissions, openOptions }
}

describe('popup', () => {
  it('shows_todays_pulse_levels_top_sites_and_intentions', async () => {
    renderPopup()

    const pulse = await screen.findByRole('group', { name: en['popup.pulse.label'] })
    expect(pulse).toHaveTextContent('42')
    expect(pulse).toHaveTextContent('of 100 · 4 h 12 min tracked')
    const sites = screen.getByRole('table', { name: en['popup.topSites.title'] })
    const rows = within(sites).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('news.example60Distracting')
    expect(rows[2]).toHaveTextContent('docs.example30Focus')
    expect(screen.getByText('4 intentions · 2 on time · 1 broken · 3 closes')).toBeInTheDocument()
  })

  it('an_empty_day_shows_a_dash_and_says_nothing_is_tracked', async () => {
    renderPopup({ today: EMPTY_DAY })

    const pulse = await screen.findByRole('group', { name: en['popup.pulse.label'] })
    expect(pulse).toHaveTextContent('—')
    expect(pulse).toHaveTextContent(en['stat.missing'])
    expect(pulse).toHaveTextContent(en['popup.pulse.empty'])
    expect(screen.getByText(en['popup.topSites.empty'])).toBeInTheDocument()
    expect(screen.getByText(en['popup.intentions.none'])).toBeInTheDocument()
  })

  it('warns_when_private_windows_are_a_way_around_the_rules', async () => {
    renderPopup({ incognito: false })

    expect(await screen.findByText(en['popup.warning.incognito'])).toBeInTheDocument()
  })

  it('warns_about_missing_site_access_and_asks_for_it', async () => {
    const { permissions } = renderPopup({ granted: [] })

    await userEvent.click(
      await screen.findByRole('button', { name: en['popup.warning.permissionsAction'] })
    )

    expect(permissions.request).toHaveBeenCalledWith({ origins: [...SITE_HOST_PERMISSIONS] })
    await waitFor(() =>
      expect(screen.queryByText(en['popup.warning.permissions'])).not.toBeInTheDocument()
    )
  })

  it('without_the_intention_gate_no_intention_is_shown', async () => {
    renderPopup()

    await screen.findByRole('group', { name: en['popup.pulse.label'] })
    expect(screen.queryByText(en['popup.intention.title'])).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en['popup.intention.endNow'] })).toBeNull()
  })

  it('an_active_intention_shows_its_time_left_and_can_end_now', async () => {
    const { end } = renderPopup({ intention: true })

    expect(await screen.findByText('Read one answer')).toBeInTheDocument()
    expect(screen.getByText('4:05 left')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: en['popup.intention.endNow'] }))

    expect(end).toHaveBeenCalledWith({ targetGroup: 'starter-reddit-friction' }, expect.anything())
  })

  it('there_is_no_on_off_switch', async () => {
    renderPopup()

    await screen.findByRole('group', { name: en['popup.pulse.label'] })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('remembers_the_table_view_of_the_level_chart', async () => {
    const { set } = renderPopup()

    await userEvent.click(await screen.findByRole('radio', { name: en['chartTable.table'] }))

    expect(screen.getByRole('table', { name: en['popup.levels.title'] })).toBeInTheDocument()
    expect(set).toHaveBeenCalledWith(
      { key: 'ui.chartView.todayLevels', value: 'table' },
      expect.anything()
    )
  })

  it('opens_with_the_stored_table_view', async () => {
    renderPopup({ chartViews: { ...PREFERENCES.chartViews, todayLevels: 'table' } })

    expect(await screen.findByRole('table', { name: en['popup.levels.title'] })).toBeInTheDocument()
  })

  it('footer_opens_settings_and_statistics', async () => {
    const { openOptions } = renderPopup()

    await userEvent.click(await screen.findByRole('button', { name: en['popup.footer.stats'] }))
    await userEvent.click(screen.getByRole('button', { name: en['popup.footer.settings'] }))

    expect(openOptions.mock.calls).toEqual([['stats'], ['rules']])
  })
})

describe('popupViewModel', () => {
  it('rounds_seconds_to_minutes_and_keeps_at_most_five_sites', () => {
    const many = Array.from({ length: 7 }, (_value, index) => ({
      activityKey: `site${index}.example`,
      seconds: 90,
      level: 2 as const,
    }))

    const model = popupViewModel({
      today: { ...BUSY_DAY, topActivities: many },
      incognitoAllowed: null,
      missingOrigins: [],
      activeIntention: null,
    })

    expect(model.minutesByLevel).toEqual([60, 10, 20, 30, 132])
    expect(model.topSites).toHaveLength(5)
    expect(model.topSites[0]).toEqual({ domain: 'site0.example', minutes: 2, level: 2 })
    expect(model.warnings).toEqual([])
  })
})
