// SPDX-License-Identifier: AGPL-3.0-or-later
import { Timer } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { ActiveIntention } from '../shared/IntentionContract'
import type { Clock } from '../shared/clock'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { formatMinutesSeconds, remainingSeconds } from '../ui/RemainingTime'

export interface ActiveIntentionPanelProps {
  intention: ActiveIntention
  clock: Clock
  onEnd: () => void
}

/** The running intention: what it is for, `m:ss` left (from `expiresAt`), "End now". */
export function ActiveIntentionPanel({ intention, clock, onEnd }: ActiveIntentionPanelProps) {
  const { t } = useI18n()
  const [seconds, setSeconds] = useState(() => remainingSeconds(intention.expiresAt, clock.now()))
  useEffect(() => {
    const tick = () => setSeconds(remainingSeconds(intention.expiresAt, clock.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [intention.expiresAt, clock])

  return (
    <section class="popup__section popup__intention" aria-labelledby="popup-intention-title">
      <h2 id="popup-intention-title" class="popup__label">
        <Icon icon={Timer} size={16} />
        {t('popup.intention.title')}
      </h2>
      <p class="popup__intention-text">
        {intention.text ?? intention.site ?? t('popup.intention.untitled')}
      </p>
      <p class="popup__intention-meta">
        <span class="popup__numeric">
          {t('popup.intention.left', { time: formatMinutesSeconds(seconds) })}
        </span>
        <Button variant="quiet" onClick={onEnd}>
          {t('popup.intention.endNow')}
        </Button>
      </p>
    </section>
  )
}
