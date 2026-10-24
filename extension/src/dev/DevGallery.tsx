// SPDX-License-Identifier: AGPL-3.0-or-later
import { SUPPORTED_LOCALES } from '../i18n/locale'
import type { Clock } from '../shared/clock'
import './DevGallery.css'
import { DevPanel, type DevTheme } from './DevPanel'

const THEMES: readonly DevTheme[] = ['light', 'dark']

export interface DevGalleryProps {
  clock: Clock
}

/**
 * The UI kit gallery (`/dev.html`, development build only): every component
 * in both themes and both languages, side by side, with synthetic data.
 */
export function DevGallery({ clock }: DevGalleryProps) {
  return (
    <div class="dev-gallery">
      {SUPPORTED_LOCALES.flatMap((locale) =>
        THEMES.map((theme) => (
          <DevPanel key={`${theme}-${locale}`} theme={theme} locale={locale} clock={clock} />
        ))
      )}
    </div>
  )
}
