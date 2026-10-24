// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SimpleKey } from '../i18n/t'

/**
 * A useful part the feed placeholder offers instead of the feed. Labels are
 * catalog keys; hrefs are paths on the page's own origin.
 */
export type PlaceholderPart =
  /** A search box that opens `<action>?<param>=<query>` on the site. */
  | { kind: 'search'; action: string; param: string }
  /** A link to a useful page of the site. */
  | { kind: 'link'; href: string; labelKey: SimpleKey }
  /** A button that selects a tab of the page itself (X: Following). */
  | { kind: 'tab'; selector: string; labelKey: SimpleKey }
  /** The list of communities the user allows (filled in by E8). */
  | { kind: 'communities' }

/**
 * Extension-only DOM knowledge of one site (02 §1.4, second layer): which
 * elements make up each surface. Keys are surface ids of
 * `packages/rules/data/surfaces.json`; which paths are which surface, and
 * whether a surface is hidden, comes only from the engine. Selectors use
 * stable custom elements and attributes (`shreddit-feed`, `data-testid`,
 * `ytd-*`, `is-shorts`, ARIA roles), never hashed class names.
 */
export interface SiteFeedProfile {
  /** The `domain` of the site profile in `packages/rules/data/sites`. */
  domain: string
  /** Catalog key of the site's name, shown in the placeholder. */
  nameKey: SimpleKey
  /**
   * Page content of a surface, hidden while the page itself is that surface
   * and the engine hides it (`html[data-mf-hide~="<surface>"]`). The first
   * element that matches is where the placeholder mounts.
   */
  hide: Readonly<Record<string, readonly string[]>>
  /**
   * Entry points of a surface (nav links, shelves), hidden on every page of
   * the site while the rule set restricts it (`html[data-mf-restrict~="<surface>"]`).
   */
  entryPoints: Readonly<Record<string, readonly string[]>>
  /** What the placeholder offers instead of the feed. */
  placeholder: readonly PlaceholderPart[]
}
