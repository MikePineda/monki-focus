// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { Translate } from '../i18n/t'
import type { Clock } from '../shared/clock'
import './Countdown.css'
import { formatMinutesSeconds, remainingSeconds } from './RemainingTime'
import './VisuallyHidden.css'

export interface CountdownProps {
  /** Stored end of the wait (`pauseEndsAt`, epoch ms): a reload never resets it. */
  endsAt: number
  clock: Clock
  onDone?: () => void
}

/** Re-read the clock four times a second so a second never shows late. */
const TICK_MS = 250
/** Screen readers hear the time every 5 s, not every second. */
const ANNOUNCE_EVERY_SECONDS = 5

function announcement(t: Translate, seconds: number): string {
  if (seconds < 60) return t('countdown.secondsLeft', { count: seconds })
  return t('countdown.minutesLeft', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
}

/**
 * Big tabular countdown. The digits are hidden from assistive technology;
 * a polite live region carries the time in words and only changes on
 * multiples of 5 s (and at zero), so it never chatters every second.
 */
export function Countdown({ endsAt, clock, onDone }: CountdownProps) {
  const { t } = useI18n()
  const [seconds, setSeconds] = useState(() => remainingSeconds(endsAt, clock.now()))
  const [announced, setAnnounced] = useState(seconds)
  const doneReported = useRef(false)

  useEffect(() => {
    const tick = () => setSeconds(remainingSeconds(endsAt, clock.now()))
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [endsAt, clock])

  useEffect(() => {
    if (seconds % ANNOUNCE_EVERY_SECONDS === 0) setAnnounced(seconds)
    if (seconds === 0 && !doneReported.current) {
      doneReported.current = true
      onDone?.()
    }
  }, [seconds, onDone])

  return (
    <div class="mf-countdown">
      <p class="mf-countdown__display" aria-hidden="true">
        {seconds < 60 ? (
          <>
            <span class="mf-countdown__value">{seconds}</span>
            <span class="mf-countdown__unit">{t('countdown.secondsUnit')}</span>
          </>
        ) : (
          <span class="mf-countdown__value">{formatMinutesSeconds(seconds)}</span>
        )}
      </p>
      <p class="mf-visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement(t, announced)}
      </p>
    </div>
  )
}
