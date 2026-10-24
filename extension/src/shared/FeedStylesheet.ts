// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'
import type { GuardAttributes } from './GuardAttributes'

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
 * constant selectors and the validated attribute names (no page data). The
 * content script puts it in the page at `document_start`; the service worker
 * injects the same text with the `USER` origin, which the page can neither
 * remove nor outrank.
 */
export function feedStylesheetText(site: SiteFeedProfile, attributes: GuardAttributes): string {
  return [
    ...rulesFor(attributes.hide, site.hide),
    ...rulesFor(attributes.restrict, site.pageContainers),
    ...rulesFor(attributes.restrict, site.entryPoints),
  ].join('\n')
}
