// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../i18n/I18nContext'
import { Button } from '../ui/Button'
import { OverlayCard } from '../ui/OverlayCard'

export interface TimeoutOverlayProps {
  site: string
  minutes: number | null
  intention: string | null
  /** The pause "5 more min" costs (the engine's `extend`). */
  nextPauseSeconds: number
  onLeave: () => void
  onExtend: () => void
}

/**
 * "Your 10 min for «…» are up": the page is dimmed and the card offers
 * **Leave** (the one accent action, focused first) or "5 more min", whose
 * cost the note states in the engine's numbers. There is no dismiss.
 */
export function TimeoutOverlay({
  site,
  minutes,
  intention,
  nextPauseSeconds,
  onLeave,
  onExtend,
}: TimeoutOverlayProps) {
  const { t } = useI18n()
  const title =
    minutes === null
      ? t('timeout.titleUnknown')
      : intention
        ? t('timeout.title', { minutes, intention })
        : t('timeout.titleNoIntention', { minutes })
  return (
    <OverlayCard
      context={minutes === null ? site : t('timeout.context', { site, minutes })}
      title={title}
      note={t('timeout.note', { seconds: nextPauseSeconds })}
    >
      <Button variant="leave" onClick={onLeave}>
        {t('timeout.leave', { site })}
      </Button>
      <Button variant="secondary" onClick={onExtend}>
        {t('timeout.more')}
      </Button>
    </OverlayCard>
  )
}
