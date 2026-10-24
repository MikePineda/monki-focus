// SPDX-License-Identifier: AGPL-3.0-or-later
import { probeTab, type ActivityEvent } from '@monki-focus/analytics'
import { instantOf, type RulesCatalog } from '@monki-focus/engine'
import type { IdleWatcher } from './IdleWatcher'
import type { TrackedTab, TrackingBrowser } from './TrackingBrowser'
import type { TrackingSettings } from './TrackingSettings'
import type { WindowFocusGrace } from './WindowFocusGrace'

export interface ActiveTabProbeDependencies {
  windows: Pick<TrackingBrowser['windows'], 'getLastFocused'>
  tabs: Pick<TrackingBrowser['tabs'], 'query'>
  idle: Pick<IdleWatcher, 'state'>
  focus: Pick<WindowFocusGrace, 'isFocused'>
  settings: () => Promise<TrackingSettings>
  catalog: RulesCatalog
}

/**
 * Samples the active tab of the focused window and turns it into a heartbeat
 * with the analytics core's `probeTab`: nothing without a focused window
 * (after the focus grace), while idle unless the tab is audible, or for a
 * non-http(s) page.
 *
 * Incognito (only reachable when the user allowed the extension there): the
 * time counts, but the event holds the domain only. The path becomes `/` and
 * the surface `null`, and a title is never stored, whatever the settings say.
 */
export class ActiveTabProbe {
  constructor(private readonly deps: ActiveTabProbeDependencies) {}

  async probe(nowMs: number): Promise<ActivityEvent | null> {
    const window = await this.deps.windows.getLastFocused()
    const windowFocused = window.id !== undefined && this.deps.focus.isFocused(window, nowMs)
    const tab = windowFocused && window.id !== undefined ? await this.activeTab(window.id) : null
    const [idleState, settings] = await Promise.all([this.deps.idle.state(), this.deps.settings()])
    const heartbeat = probeTab(
      {
        now: instantOf(nowMs),
        windowFocused,
        idleState,
        tab: tab === null ? null : probedTab(tab, settings),
        settings,
      },
      this.deps.catalog
    )
    if (heartbeat === null || !('domain' in heartbeat.data) || !heartbeat.data.incognito) {
      return heartbeat
    }
    const { domain, audible } = heartbeat.data
    return {
      ...heartbeat,
      data: { domain, path: '/', surface: null, audible, incognito: true },
    }
  }

  private async activeTab(windowId: number): Promise<TrackedTab | null> {
    const [tab] = await this.deps.tabs.query({ active: true, windowId })
    return tab?.url ? tab : null
  }
}

function probedTab(tab: TrackedTab, settings: TrackingSettings) {
  const keepTitle = settings.storeTitles && !tab.incognito && tab.title !== undefined
  return {
    url: tab.url ?? '',
    audible: tab.audible === true,
    incognito: tab.incognito,
    ...(keepTitle && tab.title !== undefined ? { title: tab.title } : {}),
  }
}
