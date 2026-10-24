// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from 'preact'
import { resolveLocale } from '../i18n/locale'
import { createTranslator, type MessageKey } from '../i18n/t'
import '../theme/tokens.css'
import { PageShell } from './PageShell'

export interface StartPageOptions {
  titleKey: MessageKey
  root?: HTMLElement | null
}

/**
 * Boots an extension page: resolves the locale, sets `<html lang>` and the
 * document title, and renders the page shell into `#app`.
 *
 * TODO(E8): read the user's language choice from storage before falling back
 * to `navigator.languages`.
 */
export function startPage({ titleKey, root = document.getElementById('app') }: StartPageOptions) {
  if (!root) throw new Error('startPage: missing #app root element')
  const locale = resolveLocale(navigator.languages)
  const t = createTranslator(locale)
  document.documentElement.lang = locale
  document.title = t(titleKey)
  render(<PageShell title={t(titleKey)} />, root)
}
