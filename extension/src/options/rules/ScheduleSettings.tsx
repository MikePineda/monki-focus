// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Bedtime, Ruleset, Schedule } from '@monki-focus/rules/pure'
import { Moon } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { Icon } from '../../ui/Icon'
import { InputField } from '../../ui/InputField'
import { WeekdayPicker } from '../../ui/WeekdayPicker'
import { setBedtime, setWorkHours } from './RulesetEdits'

export interface ScheduleSettingsProps {
  ruleset: Ruleset
  onPropose: (next: Ruleset) => Promise<boolean>
}

/** Bedtime (on or off, start, end, days) and the work hours rules can refer to. */
export function ScheduleSettings({ ruleset, onPropose }: ScheduleSettingsProps) {
  const { t } = useI18n()
  const [bedtime, setBedtimeDraft] = useState<Bedtime>(ruleset.bedtime)
  const [workHours, setWorkHoursDraft] = useState<Schedule>(ruleset.workHours)

  return (
    <>
      <form
        class="options__block"
        aria-labelledby="options-bedtime"
        onSubmit={(event) => {
          event.preventDefault()
          void onPropose(setBedtime(ruleset, bedtime))
        }}
      >
        <h3 id="options-bedtime" class="options__subheading">
          <Icon icon={Moon} />
          {t('rules.bedtime.title')}
        </h3>
        <p class="options__muted">{t('rules.bedtime.body')}</p>
        <Checkbox
          label={t('rules.bedtime.enabled')}
          checked={bedtime.enabled}
          onChange={(enabled) => setBedtimeDraft({ ...bedtime, enabled })}
        />
        <div class="options__grid">
          <InputField
            type="time"
            label={t('schedule.start')}
            value={bedtime.start}
            onInput={(start) => setBedtimeDraft({ ...bedtime, start })}
          />
          <InputField
            type="time"
            label={t('schedule.end')}
            value={bedtime.end}
            onInput={(end) => setBedtimeDraft({ ...bedtime, end })}
          />
        </div>
        <WeekdayPicker
          label={t('rules.bedtime.days')}
          value={bedtime.days}
          onChange={(days) => setBedtimeDraft({ ...bedtime, days })}
        />
        <div class="options__actions">
          <Button variant="ink" type="submit">
            {t('rules.bedtime.save')}
          </Button>
        </div>
      </form>

      <form
        class="options__block"
        aria-labelledby="options-work-hours"
        onSubmit={(event) => {
          event.preventDefault()
          void onPropose(setWorkHours(ruleset, workHours))
        }}
      >
        <h3 id="options-work-hours" class="options__subheading">
          {t('rules.workHours.title')}
        </h3>
        <p class="options__muted">{t('rules.workHours.body')}</p>
        <div class="options__grid">
          <InputField
            type="time"
            label={t('schedule.start')}
            value={workHours.start}
            onInput={(start) => setWorkHoursDraft({ ...workHours, start })}
          />
          <InputField
            type="time"
            label={t('schedule.end')}
            value={workHours.end}
            onInput={(end) => setWorkHoursDraft({ ...workHours, end })}
          />
        </div>
        <WeekdayPicker
          label={t('schedule.days')}
          value={workHours.days}
          onChange={(days) => setWorkHoursDraft({ ...workHours, days })}
        />
        <div class="options__actions">
          <Button variant="ink" type="submit">
            {t('rules.workHours.save')}
          </Button>
        </div>
      </form>
    </>
  )
}
