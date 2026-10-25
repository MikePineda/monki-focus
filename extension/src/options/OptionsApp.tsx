// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChartColumn, Info, Settings, Shield } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { DownloadFile } from '../pages/FileDownload'
import type { CommandClient } from '../shared/CommandClient'
import type { OptionalPermissionsApi } from '../shared/NativeMessagingPermission'
import type { PermissionsApi } from '../shared/SiteOrigins'
import { Icon, type LucideIcon } from '../ui/Icon'
import { AboutSection } from './about/AboutSection'
import './Options.css'
import { PreferencesSection } from './preferences/PreferencesSection'
import { RulesSection } from './rules/RulesSection'
import { StatsSection } from './stats/StatsSection'

export const OPTIONS_SECTIONS = ['rules', 'preferences', 'stats', 'about'] as const
export type OptionsSection = (typeof OPTIONS_SECTIONS)[number]

/** `#stats` → `stats`; anything else opens the rules. */
export function sectionOfHash(hash: string): OptionsSection {
  const name = hash.replace(/^#/, '')
  return (OPTIONS_SECTIONS as readonly string[]).includes(name) ? (name as OptionsSection) : 'rules'
}

const ICONS: Record<OptionsSection, LucideIcon> = {
  rules: Shield,
  preferences: Settings,
  stats: ChartColumn,
  about: Info,
}

export interface OptionsAppProps {
  client: CommandClient
  permissions: PermissionsApi
  /** API permissions: the optional `nativeMessaging` of the Mac app bridge. */
  optionalPermissions: OptionalPermissionsApi
  download: DownloadFile
  version: string
  /** Seam for tests; the page reads and follows `location.hash`. */
  initialHash?: string
}

/** The options page: a side nav of plain links (`#rules`, …) and the active section. */
export function OptionsApp({
  client,
  permissions,
  optionalPermissions,
  download,
  version,
  initialHash,
}: OptionsAppProps) {
  const { t } = useI18n()
  const [section, setSection] = useState<OptionsSection>(() =>
    sectionOfHash(initialHash ?? location.hash)
  )

  useEffect(() => {
    const follow = () => setSection(sectionOfHash(location.hash))
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  return (
    <div class="options">
      <nav class="options__nav" aria-label={t('options.nav')}>
        <ul>
          {OPTIONS_SECTIONS.map((name) => (
            <li key={name}>
              <a
                class="options__nav-item"
                href={`#${name}`}
                aria-current={section === name ? 'page' : undefined}
                onClick={() => setSection(name)}
              >
                <Icon icon={ICONS[name]} />
                {t(`options.section.${name}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section class="options__content" aria-labelledby="options-section-title">
        <h2 id="options-section-title" class="options__heading">
          {t(`options.section.${section}`)}
        </h2>
        {section === 'rules' ? (
          <RulesSection client={client} permissions={permissions} download={download} />
        ) : null}
        {section === 'preferences' ? (
          <PreferencesSection client={client} optionalPermissions={optionalPermissions} />
        ) : null}
        {section === 'stats' ? <StatsSection client={client} download={download} /> : null}
        {section === 'about' ? <AboutSection version={version} /> : null}
      </section>
    </div>
  )
}
