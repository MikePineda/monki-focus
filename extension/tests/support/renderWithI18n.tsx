// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, type RenderResult } from '@testing-library/preact'
import type { ComponentChildren } from 'preact'
import { I18nProvider } from '../../src/i18n/I18nContext'
import type { Locale } from '../../src/i18n/locale'

/** `render` inside an I18nProvider, the way every extension page mounts. */
export function renderWithI18n(ui: ComponentChildren, locale: Locale = 'en'): RenderResult {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>)
}
