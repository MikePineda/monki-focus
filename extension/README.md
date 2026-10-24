# `@monki-focus/extension`

Chromium MV3 extension (Chrome, Brave): WXT 0.21 on Vite 8, Preact, TypeScript,
Vitest and Playwright. Phase 1 (E1-E9) fills in feed hiding, the intention gate,
tracking and the popup; this package is the skeleton they build on.

## Commands

| Command                                     | What                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev -w @monki-focus/extension`     | WXT dev server (mode `development`), opens a browser with the build |
| `npm run build -w @monki-focus/extension`   | production build in `.output/chrome-mv3`                            |
| `npm run build:dev -w …` / `build:e2e -w …` | `.output/chrome-mv3-dev` / `.output/chrome-mv3-e2e`                 |
| `npm run zip -w @monki-focus/extension`     | `.output/monki-focus-extension-<version>-chrome.zip` (production)   |
| `npm run test -w @monki-focus/extension`    | Vitest unit tests (`tests/unit`, `fakeBrowser` via `WxtVitest()`)   |
| `npm run e2e -w @monki-focus/extension`     | builds `e2e` and `dev`, runs Playwright (`e2e/tests`)               |

First E2E run on a machine: `npx playwright install chromium`.

## Build modes and the extension id

`wxt.config.ts` derives the manifest from the build mode
(`config/extensionManifest.ts`):

- `development` and `e2e` add `manifest.key` from the env var
  `EXTENSION_DEV_PUBLIC_KEY` (base64 DER public key, no PEM armour) when it is
  set, which pins the unpacked extension id (needed later for native messaging
  `allowed_origins`). Without it the unpacked id is derived from the folder
  path and varies between machines; tests never hard-code it.
- `production` (`build`, `zip`) never carries a `key`; the store assigns the id.

Only the public key is ever used. The private key (`.pem`) never enters the
repo (`*.pem` is gitignored).

## Layout

```
src/entrypoints/   background.ts and feed-guard.content/ (wiring only), popup/, options/, gate/
src/background/    service-worker modules (commands/, decisions/, rules/, shorts/)
src/content/       feed guard: FeedGuard, FeedHider, SpaNavigationWatcher, FeedPlaceholder, ...
src/sites/         per-site DOM selectors keyed by surface id (reddit, x, youtube, instagram)
src/shared/        clock.ts, messages.ts (typed commands), bundledRulesCatalog.ts, FeedSurfaces.ts
src/i18n/          catalogs/{en,es}.json, t.ts, locale.ts, LanguagePreference.ts, I18nContext.tsx
src/theme/         tokens.css (imports @monki-focus/design-tokens), applyTheme.ts, bootTheme.ts
src/ui/            Preact UI kit, one component per file with its own CSS
src/dev/           UI kit gallery (dev.html, development build only)
public/rules/      static DNR rulesets (shorts-redirect.json)
public/_locales/   store name and description only
tests/unit/        mirrors src/
e2e/               Playwright: support/, fixtures/sites/<site>/, tests/
```

## Rules this package enforces

- The service worker is the only writer of state; other contexts send typed
  commands (`src/shared/messages.ts`). `CommandRouter` answers only messages
  whose `sender.id` is this extension's id; there is no
  `externally_connectable`.
- UI copy comes only from `src/i18n/catalogs` (`en`, `es`); a parity test fails
  on any missing key and ESLint (`i18next/no-literal-string`) rejects literal
  JSX text in `src/ui` and `src/entrypoints`. No `innerHTML`.
- Colours, type and spacing come only from the `--mf-*` variables of
  `@monki-focus/design-tokens` (`src/theme/tokens.css` imports the generated
  CSS; Vite bundles it). `no_raw_hex_in_extension_sources` fails on any hex
  colour or colour function under `src/`. Motion runs only inside a
  `prefers-reduced-motion` query (`ui_motion_only_runs_behind_a_reduced_motion_query`).

## UI kit, themes and i18n (E4)

- Components (`src/ui`): `Button` (`leave` = the one accent fill, only for a
  gate's close/leave action; `ink`; `secondary`; `quiet`), `Segmented`,
  `TextField`, `Countdown`, `ProgressLine`, `StatNumber`, `LevelBar`,
  `DataTable`, `ChartTableToggle`, `Toast`, `Banner`, `OverlayCard`,
  `ListRow`, `PageShell`. Components that own copy read `useI18n()`; others
  take translated strings as props. Icons are Lucide only, through `Icon`.
- Theme: the stored preference (`ui.theme` in `storage.local`: `system`,
  `light`, `dark`) becomes `data-theme` on `<html>` (or a shadow host);
  `system` removes the attribute so `prefers-color-scheme` decides. Storage is
  async, so pages keep a synchronous copy in `localStorage` and
  `bootTheme.ts`, a module script in every page's `<head>` (MV3 CSP forbids
  inline scripts), applies it before the page renders; `startPage` then
  confirms it from storage and follows later changes.
- Language: `ui.language` (`system`, `en`, `es`) wins over
  `navigator.languages`.
- Plurals without ICU: `<key>_one` / `<key>_other` in both catalogs,
  `t(key, { count })` picks the form with `Intl.PluralRules` and falls back to
  `_other` (Spanish `many`). Parity tests check both forms exist.
- `/dev.html` (`npm run build:dev`, or `npm run dev`) shows every component in
  both themes and both languages with synthetic data. `config/devOnlyEntrypoints.ts`
  marks it skipped in the e2e and production builds, so the zip never has it.
- Inter is not bundled yet; the token font stack falls back to the system face.

## Feeds and Shorts (E5)

"Remove the feed, not the tool." Which page is which surface, and whether it
is hidden, comes only from `@monki-focus/engine` over the user's rule set;
the extension never lists feed paths.

- **Decisions.** `DecisionService` (service worker) builds the engine catalog
  once from `@monki-focus/rules/pure`, reads the rule set from
  `storage.local` (`rules.ruleset`, created from the starter preset with the
  device time zone at install; the engine pins it afterwards) and answers
  `decision.get` with `decide(...)` at `instantOf(Date.now())`. Anything that
  throws answers the engine's `engine_error` decision (block, hide every feed
  of the site). The router only answers `decision.get` from a tab whose URL
  has the same host as the URL asked about.
- **Feed guard** (`feed-guard.content`, `document_start`, the four sites and
  their subdomains/aliases). It injects one `<style>` whose rules key on
  `html[data-mf-hide~="<surface>"]` (page content of the current surface)
  and `html[data-mf-restrict~="<surface>"]` (entry points such as Shorts
  shelves or the Reels link, hidden on every page while the surface is
  restricted). Until the first answer it hides the page's surface when the
  bundled catalog says it is a feed; after 1.5 s without an answer it stays
  hidden and shows the placeholder (fail closed); a late answer still
  applies. `SpaNavigationWatcher` re-evaluates on `popstate`,
  `yt-navigate-finish`, `<title>` changes and a 1 s URL poll; nothing is
  patched in the page's MAIN world.
- **Placeholder.** `FeedPlaceholder` mounts in an open shadow root right
  before the hidden feed, with the tokens and UI kit CSS inlined into the
  shadow root only (`cssInjectionMode: 'manual'`): Reddit search and the
  allowed communities (filled by E8), X Following and Search, YouTube search
  and Subscriptions, Instagram Direct and Search. Text comes only from the
  catalogs; nothing read from the page is shown or sent anywhere.
- **Selectors** live in `src/sites/<site>.ts`, keyed by the surface ids of
  `packages/rules/data/surfaces.json` (a test checks every key): custom
  elements and stable attributes only (`shreddit-feed`, `data-testid`,
  `ytd-browse[page-subtype]`, `is-shorts`, ARIA roles, exact `href`s), never
  hashed class names. X "For you" is the first tab of the home tablist, by
  position, never by its text.
- **Shorts.** The static DNR ruleset `shorts-redirect` turns a hard load of
  `https://(www.|m.)youtube.com/shorts/<11-char id>` into
  `https://www.youtube.com/watch?v=<id>`. Chromium refuses to compile a
  counted id followed by an optional tail (the 2 KB regex memory cap; the
  rule is then silently skipped), so the ruleset spells the end of the id as
  three anchored rules: end of URL, `/…` and `?…`. `ShortsRedirectSync`
  enables or disables the ruleset with `updateEnabledRulesets` whenever the
  rule set changes, at start-up and on every YouTube decision, according to
  whether the rule set blocks or hides `youtube.shorts`. In-app navigations
  to `/shorts/…` (which DNR never sees) are replaced by the watch URL in the
  feed guard.
- The `e2e` build can delay decisions (`e2e.decisionDelayMs` in
  `storage.local`) to test the fail-closed timeout; the production bundle
  drops that code.

## Live smoke before release

The E2E fixtures imitate the sites; the real ones change without notice.
Before every release, in Chrome and in Brave, with the production zip loaded
unpacked and the starter rule set:

1. **Reddit** (`www.reddit.com`, signed out and signed in): the home feed and
   `/r/popular/` are gone, the placeholder shows search; a search returns
   results; a post permalink shows the post and its comments; old Reddit
   (`old.reddit.com`) hides `#siteTable` on the front page only.
2. **X** (`x.com` and `twitter.com`): Home shows the placeholder on "For you"
   (check in a non-English UI too), "Following" shows its timeline, the
   placeholder's Following button switches tabs, Explore is hidden and its
   nav link is gone, a status permalink and search work.
3. **YouTube**: the home grid is gone, the placeholder search opens
   `/results`, Subscriptions works; no Shorts shelf on search results or a
   watch page; the Shorts guide entry is hidden; pasting a `/shorts/<id>`
   URL lands on `/watch?v=<id>`; clicking a Short inside the site (SPA) lands
   on the watch page; `m.youtube.com/shorts/<id>` redirects as well.
4. **Instagram**: `/reels/` and `/explore/` show the placeholder and their
   nav links are gone; the home feed, Direct (`/direct/inbox/`), search and a
   post permalink work.
5. **No flash**: reload each feed page with the cache disabled; the feed
   never paints before it disappears.
6. **Placeholder**: right language (switch `ui.language`), right theme in
   light and dark, keyboard reachable, nothing from the page inside it.
7. If any selector no longer matches, update `src/sites/<site>.ts` and its
   synthetic fixture under `e2e/fixtures/sites/` in the same change.

## E2E harness

- Playwright's bundled Chromium with `channel: 'chromium'` in a persistent
  context, plus `--disable-extensions-except` / `--load-extension`. The
  default headless shell does not load extensions (verified with
  `@playwright/test` 1.64.1: the service worker never starts), and branded
  Chrome 137+ ignores `--load-extension`.
- No real sites: `e2e/support/fixtureServer.ts` serves
  `e2e/fixtures/sites/<site>/` over HTTPS (self-signed per run) on a free
  ephemeral loopback port, and `--host-resolver-rules` maps reddit, x/twitter,
  youtube and instagram (and subdomains) to `127.0.0.1:<port>`; every other
  host fails to resolve. Pages keep their real origin
  (`https://www.reddit.com/`), so host permissions and content-script matches
  apply unchanged, and no privileged port 443 is needed.
- Fixture pages are synthetic: real DOM structure, invented content.
