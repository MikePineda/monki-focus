// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChartColumn, Table2 } from 'lucide-preact'
import { useI18n } from '../i18n/I18nContext'
import { Segmented } from './Segmented'

export type ChartView = 'chart' | 'table'

export interface ChartTableToggleProps {
  /** Already translated chart title; names the group ("Show … as"). */
  title: string
  value: ChartView
  onChange: (view: ChartView) => void
  /** Popup and menu bar: 28px visual. */
  compact?: boolean
}

/**
 * Switches a chart and its table view, a first-class view with the same
 * data and order. Remembering the choice per chart is the caller's job.
 */
export function ChartTableToggle({
  title,
  value,
  onChange,
  compact = false,
}: ChartTableToggleProps) {
  const { t } = useI18n()
  return (
    <Segmented<ChartView>
      label={t('chartTable.groupLabel', { title })}
      size={compact ? 'compact' : 'default'}
      value={value}
      onChange={onChange}
      options={[
        { value: 'chart', label: t('chartTable.chart'), icon: ChartColumn },
        { value: 'table', label: t('chartTable.table'), icon: Table2 },
      ]}
    />
  )
}
