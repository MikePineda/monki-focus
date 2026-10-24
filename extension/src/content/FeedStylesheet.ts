// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'

/** `<html>` attribute listing the surfaces whose page content is hidden. */
export const HIDE_ATTRIBUTE = 'data-mf-hide'
/** `<html>` attribute listing the surfaces whose entry points are hidden. */
export const RESTRICT_ATTRIBUTE = 'data-mf-restrict'
/** Marks the extension's own `<style>` so it is injected once. */
export const STYLESHEET_ID = 'monki-focus-feed-guard'

function rulesFor(
  attribute: string,
  selectorsBySurface: Readonly<Record<string, readonly string[]>>
): string[] {
  return Object.entries(selectorsBySurface).flatMap(([surface, selectors]) =>
    selectors.map(
      (selector) => `html[${attribute}~="${surface}"] ${selector}{display:none!important}`
    )
  )
}

/**
 * The CSS that does the hiding: one rule per selector, scoped to a surface
 * token on `<html>`, so hiding is a matter of setting an attribute and
 * nothing flashes while the page renders. Built only from the site profile's
 * constant selectors (no page data).
 */
export function feedStylesheetText(site: SiteFeedProfile): string {
  return [
    ...rulesFor(HIDE_ATTRIBUTE, site.hide),
    ...rulesFor(RESTRICT_ATTRIBUTE, site.entryPoints),
  ].join('\n')
}

/**
 * Injects the stylesheet at `document_start`, before `<head>` exists, by
 * appending to `<html>`; idempotent.
 */
export function installFeedStylesheet(document: Document, site: SiteFeedProfile): void {
  if (document.getElementById(STYLESHEET_ID)) return
  const style = document.createElement('style')
  style.id = STYLESHEET_ID
  style.textContent = feedStylesheetText(site)
  ;(document.head ?? document.documentElement).append(style)
}
