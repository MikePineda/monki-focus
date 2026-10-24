// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { Clock } from '../shared/clock'
import { formatMinutesSeconds, remainingSeconds } from '../ui/RemainingTime'

export interface IntentionPillProps {
  /** The intention's end (`expiresAt`, epoch ms). */
  endsAt: number
  clock: Clock
}

const TICK_MS = 1000

/**
 * A small `mm:ss` in a corner of the page while an intention runs. Every
 * tick re-derives the time from `endsAt - now`, never from counted ticks,
 * so a throttled background tab is right the moment it is shown again.
 */
export function IntentionPill({ endsAt, clock }: IntentionPillProps) {
  const { t } = useI18n()
  const [seconds, setSeconds] = useState(() => remainingSeconds(endsAt, clock.now()))
  useEffect(() => {
    const tick = () => setSeconds(remainingSeconds(endsAt, clock.now()))
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [endsAt, clock])
  return (
    <p class="mf-intention-pill" role="timer" aria-label={t('pill.label')}>
      {formatMinutesSeconds(seconds)}
    </p>
  )
}
