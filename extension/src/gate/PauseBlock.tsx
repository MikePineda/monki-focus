// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FrictionType } from '@monki-focus/rules/pure'
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { SimpleKey } from '../i18n/t'
import type { Clock } from '../shared/clock'
import { Countdown } from '../ui/Countdown'
import { ProgressLine } from '../ui/ProgressLine'

export interface PauseBlockProps {
  frictionType: FrictionType
  pauseSeconds: number
  /** The stored end of the pause (`pauseEndsAt`): a reload never resets it. */
  endsAt: number
  /** The doubled pause of "5 more min". */
  extension: boolean
  clock: Clock
  onDone: () => void
}

const WHY: Readonly<Record<FrictionType, SimpleKey>> = {
  'countdown': 'gate.why.countdown',
  'breath': 'gate.why.breath',
  'reflect': 'gate.why.reflect',
  'type-intention': 'gate.why.typeIntention',
}

const PROGRESS_TICK_MS = 250

/**
 * The pause: the big tabular countdown and a 1px progress line, both derived
 * from the stored end time, the `breath` variant's circle (4 s in, 4 s out;
 * still under `prefers-reduced-motion`) and the "why" line of its friction
 * type.
 */
export function PauseBlock({
  frictionType,
  pauseSeconds,
  endsAt,
  extension,
  clock,
  onDone,
}: PauseBlockProps) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(clock.now()), PROGRESS_TICK_MS)
    return () => clearInterval(timer)
  }, [clock])
  const elapsed = Math.min(pauseSeconds, Math.max(0, pauseSeconds - (endsAt - now) / 1000))
  return (
    <section class="mf-gate__pause">
      {frictionType === 'breath' ? (
        <div class="mf-gate__breath" role="img" aria-label={t('gate.breathLabel')} />
      ) : null}
      <Countdown endsAt={endsAt} clock={clock} onDone={onDone} />
      <ProgressLine label={t('gate.pauseProgress')} value={elapsed} max={pauseSeconds} />
      <p class="mf-gate__why">{t(extension ? 'gate.why.extension' : WHY[frictionType])}</p>
    </section>
  )
}
