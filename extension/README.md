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
src/entrypoints/   background.ts (wiring only), popup/, options/, gate/
src/background/    service-worker modules (commands/CommandRouter.ts, ...)
src/shared/        clock.ts (injected Clock), messages.ts (typed commands)
src/i18n/          catalogs/{en,es}.json, t.ts, locale.ts, LanguagePreference.ts, I18nContext.tsx
src/theme/         tokens.css (imports @monki-focus/design-tokens), applyTheme.ts, bootTheme.ts
src/ui/            Preact UI kit, one component per file with its own CSS
src/dev/           UI kit gallery (dev.html, development build only)
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
