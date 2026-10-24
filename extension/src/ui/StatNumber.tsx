// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'preact/hooks'
import { formatNumber } from '../i18n/formatNumber'
import { useI18n } from '../i18n/I18nContext'
import './StatNumber.css'
import { VisuallyHidden } from './VisuallyHidden'

export interface StatNumberProps {
  /** Already translated caption above the number ("Pulse today"). */
  label: string
  /** `null` when there is no data: shown as an em dash, never as 0. */
  value: number | null
  /** Already translated context ("of 100 · 4 h 12 min tracked"). */
  context?: string
  /** `stat` (32px, tabular) on compact surfaces, `display` (40px) as a page hero. */
  size?: 'stat' | 'display'
}

/** Typography, not copy: the same glyph in every language. */
const EM_DASH = '—'

/** One number stated plainly: no deltas, no colour, no count-up. */
export function StatNumber({ label, value, context, size = 'stat' }: StatNumberProps) {
  const { t, locale } = useI18n()
  const labelId = useId()
  return (
    <div class={`mf-stat mf-stat--${size}`} role="group" aria-labelledby={labelId}>
      <span id={labelId} class="mf-stat__label">
        {label}
      </span>
      {value === null ? (
        <span class="mf-stat__value mf-stat__value--missing">
          <span aria-hidden="true">{EM_DASH}</span>
          <VisuallyHidden>{t('stat.missing')}</VisuallyHidden>
        </span>
      ) : (
        <span class="mf-stat__value">{formatNumber(value, locale)}</span>
      )}
      {context ? <span class="mf-stat__context">{context}</span> : null}
    </div>
  )
}
