// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Info, TriangleAlert } from 'lucide-preact'
import { useI18n } from '../i18n/I18nContext'
import './Banner.css'
import { Button } from './Button'
import { Icon, type LucideIcon } from './Icon'
import { VisuallyHidden } from './VisuallyHidden'

/**
 * - `notice`: neutral information (guardian and bypass notices). Never red.
 * - `warning`: a setup problem the user can fix.
 * - `error`: something failed.
 */
export type BannerTone = 'notice' | 'warning' | 'error'

export interface BannerAction {
  label: string
  onClick: () => void
}

export interface BannerProps {
  /** Already translated message. */
  message: string
  tone?: BannerTone
  /** At most one quiet action ("Allow"). */
  action?: BannerAction
}

const ICONS: Record<BannerTone, LucideIcon> = {
  notice: Info,
  warning: TriangleAlert,
  error: CircleAlert,
}

/** Inline, persistent until its cause is fixed; an icon plus a word, always. */
export function Banner({ message, tone = 'notice', action }: BannerProps) {
  const { t } = useI18n()
  return (
    <div class={`mf-banner mf-banner--${tone}`}>
      <Icon icon={ICONS[tone]} class="mf-banner__icon" />
      <p class="mf-banner__message">
        <VisuallyHidden>{t(`banner.${tone}`)}</VisuallyHidden>
        {message}
      </p>
      {action ? (
        <Button variant="quiet" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
