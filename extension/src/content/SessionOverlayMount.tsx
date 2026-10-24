// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from 'preact'
import { I18nProvider } from '../i18n/I18nContext'
import { preferredLocale } from '../i18n/LanguagePreference'
import type { Locale } from '../i18n/locale'
import type { Clock } from '../shared/clock'
import type { ActiveSession } from '../shared/GateContract'
import { readUiPreferences, type UiPreferences } from '../shared/UiPreferences'
import { applyTheme } from '../theme/applyTheme'
import { IntentionPill } from './IntentionPill'
import { TimeoutOverlay } from './TimeoutOverlay'

/** What the page shows of its intention: the running pill or the timeout card. */
export type SessionOverlayView =
  { kind: 'pill'; endsAt: number } | { kind: 'timeout'; session: ActiveSession }

export interface SessionOverlayMountOptions {
  document: Document
  /** Tokens + UI kit CSS for the shadow root, from the bundle. */
  css: string
  /** Random per page, so the page cannot target the host. */
  tag: string
  /** `closed` in production; e2e builds use `open` so specs can look inside. */
  shadowMode?: ShadowRootMode
  storage: Parameters<typeof readUiPreferences>[0]
  navigatorLanguages: readonly string[]
  clock: Clock
  onLeave: () => void
  onExtend: () => void
}

const SYSTEM_PREFERENCES: UiPreferences = { theme: 'system', language: 'system' }

/**
 * The intention pill and the timeout overlay of a site page, in a shadow
 * root (closed in production) under a random tag appended to `<html>`, with
 * the theme and language set inside the shadow root only. Showing the
 * timeout pauses the page's media.
 */
export class SessionOverlayMount {
  private host: HTMLElement | null = null
  private container: HTMLElement | null = null
  private locale: Promise<Locale> | null = null
  private sequence = 0

  constructor(private readonly options: SessionOverlayMountOptions) {}

  show(view: SessionOverlayView): void {
    const { document } = this.options
    const container = this.ensureHost()
    if (view.kind === 'timeout') {
      for (const media of document.querySelectorAll<HTMLMediaElement>('video, audio')) {
        media.pause()
      }
    }
    const sequence = ++this.sequence
    void (this.locale ?? Promise.resolve<Locale>('en')).then((locale) => {
      if (sequence !== this.sequence) return
      render(<I18nProvider locale={locale}>{this.content(view)}</I18nProvider>, container)
    })
  }

  clear(): void {
    this.sequence += 1
    if (this.container) render(null, this.container)
    this.host?.remove()
    this.host = null
    this.container = null
  }

  /** The shadow host, if one is in the page (tests). */
  get element(): HTMLElement | null {
    return this.host
  }

  private content(view: SessionOverlayView) {
    const { clock, onLeave, onExtend } = this.options
    if (view.kind === 'pill') return <IntentionPill endsAt={view.endsAt} clock={clock} />
    const { site, minutes, intention, nextPauseSeconds } = view.session
    return (
      <TimeoutOverlay
        site={site}
        minutes={minutes}
        intention={intention}
        nextPauseSeconds={nextPauseSeconds}
        onLeave={onLeave}
        onExtend={onExtend}
      />
    )
  }

  private ensureHost(): HTMLElement {
    const { document, css, tag, shadowMode = 'closed', storage, navigatorLanguages } = this.options
    if (this.host && this.container) {
      // A page that removed the host gets it back.
      if (!this.host.isConnected) document.documentElement.append(this.host)
      return this.container
    }
    const host = document.createElement(tag)
    const shadow = host.attachShadow({ mode: shadowMode })
    const style = document.createElement('style')
    style.textContent = css
    const container = document.createElement('div')
    container.className = 'mf-session-overlay'
    shadow.append(style, container)
    document.documentElement.append(host)
    this.host = host
    this.container = container
    this.locale = readUiPreferences(storage)
      .catch(() => SYSTEM_PREFERENCES)
      .then((preferences) => {
        applyTheme(preferences.theme, container)
        const locale = preferredLocale(preferences.language, navigatorLanguages)
        container.setAttribute('lang', locale)
        return locale
      })
    return container
  }
}
