// SPDX-License-Identifier: AGPL-3.0-or-later
import { ExternalLink } from 'lucide-preact'
import { useI18n } from '../../i18n/I18nContext'
import { Icon } from '../../ui/Icon'

/** Where the source lives (AGPL-3.0 §13: users can get the corresponding source). */
export const SOURCE_URL = 'https://github.com/MikePineda/monki-focus'
export const LICENSE_URL = `${SOURCE_URL}/blob/main/LICENSE`
export const PRIVACY_URL = `${SOURCE_URL}/blob/main/PRIVACY.md`

export interface AboutSectionProps {
  version: string
}

/** Version, source and licence links, and what the extension does with data. */
export function AboutSection({ version }: AboutSectionProps) {
  const { t } = useI18n()
  const link = (href: string, label: string) => (
    <a class="options__link" href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <Icon icon={ExternalLink} size={16} />
    </a>
  )
  return (
    <div class="options__section-body">
      <section class="options__block" aria-labelledby="options-about-app">
        <h3 id="options-about-app" class="options__subheading">
          {t('app.name')}
        </h3>
        <p class="options__numeric">{t('about.version', { version })}</p>
        <p>{t('about.license')}</p>
        <ul class="options__list">
          <li>{link(SOURCE_URL, t('about.source'))}</li>
          <li>{link(LICENSE_URL, t('about.licenseLink'))}</li>
          <li>{link(PRIVACY_URL, t('about.privacyLink'))}</li>
        </ul>
      </section>
      <section class="options__block" aria-labelledby="options-about-privacy">
        <h3 id="options-about-privacy" class="options__subheading">
          {t('about.privacy.title')}
        </h3>
        <ul class="options__bullets">
          <li>{t('about.privacy.local')}</li>
          <li>{t('about.privacy.noUrls')}</li>
          <li>{t('about.privacy.titles')}</li>
          <li>{t('about.privacy.export')}</li>
          <li>{t('about.privacy.leave')}</li>
        </ul>
      </section>
    </div>
  )
}
