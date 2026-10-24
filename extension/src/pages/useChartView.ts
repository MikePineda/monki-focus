// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { CommandClient } from '../shared/CommandClient'
import { chartViewKey, type ChartId } from '../shared/PreferenceContract'
import type { ChartView } from '../ui/ChartTableToggle'

/**
 * The remembered chart/table view of one chart (`ui.chartView.<id>`):
 * read once with `preferences.get`, saved through `preferences.set` on
 * every change. The chart shows first until the stored choice arrives.
 */
export function useChartView(
  client: CommandClient,
  chart: ChartId
): [ChartView, (view: ChartView) => void] {
  const [view, setView] = useState<ChartView>('chart')
  useEffect(() => {
    let active = true
    client
      .send('preferences.get', {})
      .then((preferences) => {
        if (active) setView(preferences.chartViews[chart])
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [client, chart])
  const change = useCallback(
    (next: ChartView) => {
      setView(next)
      void client
        .send('preferences.set', { key: chartViewKey(chart), value: next })
        .catch(() => undefined)
    },
    [client, chart]
  )
  return [view, change]
}
