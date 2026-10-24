// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import type { LanguagePreference } from '../../i18n/LanguagePreference'
import type { CommandClient } from '../../shared/CommandClient'
import type { PreferenceChange, Preferences } from '../../shared/PreferenceContract'
import type { ThemePreference } from '../../theme/ThemePreference'
import { Banner } from '../../ui/Banner'
import { Checkbox } from '../../ui/Checkbox'
import { SelectField } from '../../ui/SelectField'

export interface PreferencesSectionProps {
  client: CommandClient
}

/** Language, theme and the two tracking choices; each change saves at once. */
export function PreferencesSection({ client }: PreferencesSectionProps) {
  const { t } = useI18n()
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    client
      .send('preferences.get', {})
      .then(setPreferences)
      .catch(() => setFailed(true))
  }, [client])

  const change = (next: PreferenceChange) => {
    client
      .send('preferences.set', next)
      .then((saved) => {
        setPreferences(saved)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }

  if (preferences === null) {
    return failed ? (
      <Banner tone="error" message={t('preferences.failed')} />
    ) : (
      <p class="options__muted">{t('options.loading')}</p>
    )
  }

  return (
    <div class="options__section-body">
      {failed ? <Banner tone="error" message={t('preferences.failed')} /> : null}
      <section class="options__block" aria-labelledby="options-appearance">
        <h3 id="options-appearance" class="options__subheading">
          {t('preferences.appearance')}
        </h3>
        <div class="options__grid">
          <SelectField<LanguagePreference>
            label={t('preferences.language')}
            value={preferences.language}
            onChange={(value) => change({ key: 'ui.language', value })}
            options={[
              { value: 'system', label: t('preferences.language.system') },
              { value: 'en', label: t('preferences.language.en') },
              { value: 'es', label: t('preferences.language.es') },
            ]}
          />
          <SelectField<ThemePreference>
            label={t('preferences.theme')}
            value={preferences.theme}
            onChange={(value) => change({ key: 'ui.theme', value })}
            options={[
              { value: 'system', label: t('preferences.theme.system') },
              { value: 'light', label: t('preferences.theme.light') },
              { value: 'dark', label: t('preferences.theme.dark') },
            ]}
          />
        </div>
      </section>
      <section class="options__block" aria-labelledby="options-privacy">
        <h3 id="options-privacy" class="options__subheading">
          {t('preferences.tracking')}
        </h3>
        <Checkbox
          label={t('preferences.storeTitles')}
          description={t('preferences.storeTitles.description')}
          checked={preferences.storeTitles}
          onChange={(value) => change({ key: 'privacy.storeTitles', value })}
        />
        <Checkbox
          label={t('preferences.audible')}
          description={t('preferences.audible.description')}
          checked={preferences.countAudibleWhileIdle}
          onChange={(value) => change({ key: 'tracking.countAudibleWhileIdle', value })}
        />
      </section>
    </div>
  )
}
