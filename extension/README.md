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
  set, which pins the unpacked extension id (the native messaging host only
  answers ids in its `allowed_origins`). Without it the unpacked id is derived
  from the folder path and varies between machines; tests never hard-code it.
- `production` (`build`, `zip`) never carries a `key`; the store assigns the id.

Only the public key is ever used. The private key (`.pem`) never enters the
repo (`*.pem` is gitignored). The pinned id is the first 128 bits of the
SHA-256 of the key, one letter `a`-`p` per nibble
(`config/extensionId.ts`); print it with
`EXTENSION_DEV_PUBLIC_KEY=... npm run extension-id -w @monki-focus/extension`
and give it to the macOS app (`macos/README.md`, "Browser bridge"). A fresh
key pair for development: `openssl genrsa 2048 > dev.pem` and
`openssl rsa -in dev.pem -pubout -outform DER | base64`.

## Layout

```
src/entrypoints/   background.ts and feed-guard.content/ (wiring only), popup/, options/, gate/
src/gate/          the intention gate page (GatePage, PauseBlock, IntentionForm, GateClient)
src/popup/         popup view model and view (E8)
src/options/       options page: rules/, preferences/, stats/, about/ (E8)
src/pages/         page-side hooks (remembered chart view, file download)
src/background/    service-worker modules (commands/, data/, decisions/, gate/, preferences/, rules/, shorts/, tracking/, storage/, stats/, privacy/)
src/content/       feed guard: FeedGuard, FeedHider, SpaNavigationWatcher, FeedPlaceholder, ...
src/sites/         per-site DOM selectors keyed by surface id (reddit, x, youtube, instagram)
src/shared/        clock.ts, messages.ts (typed commands), bundledRulesCatalog.ts, FeedSurfaces.ts, StatsContract.ts
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
- Inter (variable, OFL) is self-hosted from `@fontsource-variable/inter`
  (`src/theme/inter.css`, imported by `startPage`): latin and latin-ext only,
  `font-display: swap`, bundled woff2, no network font request. Numbers use
  `tabular-nums` through the type tokens (`stat`, `numeric`, tables).

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
  their subdomains/aliases). Hiding is CSS keyed on two `<html>` attributes
  with **random names per page** (no fixed `data-*` a site could detect or
  strip): `hide` lists the surface whose page content is hidden (URL-scoped),
  `restrict` the restricted surfaces whose page containers (YouTube
  `ytd-browse[page-subtype]`) and entry points (Shorts shelves, the Reels
  link) are hidden on every page, so an SPA cannot show them between a
  navigation and its decision. The stylesheet goes into the page as a
  `<style>` at `document_start` (first paint) and is injected again by the
  service worker with `scripting.insertCSS({origin: 'USER'})`, which the page
  can neither remove nor outrank; MutationObservers put the `<style>` and the
  attribute values straight back if the page touches them. Until the first
  answer it hides the page's surface when the bundled catalog says it is a
  feed; after 1.5 s without an answer it stays hidden and shows the
  placeholder (fail closed); a late answer applies only while the page is
  still on that URL.
- **Re-evaluation.** `SpaNavigationWatcher` listens to the Navigation API
  (`currententrychange`, `navigate`; reachable from the isolated world and
  verified by an E2E with the poll disabled), `popstate`,
  `yt-navigate-finish`, `<title>` changes and a 250 ms URL poll; nothing is
  patched in the page's MAIN world. Every answer carries the earliest
  `validUntil` of the decisions it is made of (the page's and the restricted
  feeds'), and the page asks again then (`ValidityTimer`, capped at 15 min).
  The service worker keeps one alarm (`decision.validUntil`) at the earliest
  `validUntil` of every decision it made (`ValidityAlarm`) and then re-syncs
  the Shorts and gate redirects and pushes `decision.changed` to open site
  tabs; it also pushes when the rule set changes and, as a coarse backstop,
  when the per-minute `decision.refresh` alarm sees the rules in force change
  (active schedules, bedtime phase, local date: `RestrictionWatcher`, no
  decision probes). Pages restored from the back/forward cache ask again. After an install or update
  the feed guard is injected into open site tabs (`scripting.executeScript`);
  an orphaned instance tears itself down once its runtime id is gone.
- **Placeholder.** `FeedPlaceholder` mounts in a **closed** shadow root
  (open only in the `e2e` build) under a random tag right before the hidden
  feed, with the tokens and UI kit CSS inlined into the shadow root only
  (`cssInjectionMode: 'manual'`); theme and language sit inside the shadow
  root, never on the host. It offers Reddit search and the allowed
  communities (filled by E8), X Following and Search, YouTube search and
  Subscriptions, Instagram Direct and Search. Text comes only from the
  catalogs; nothing read from the page is shown or sent anywhere.
- **Selectors** live in `src/sites/<site>.ts`, keyed by the surface ids of
  `packages/rules/data/surfaces.json` (a test checks every key): custom
  elements and stable attributes only (`shreddit-feed`, `data-testid`,
  `ytd-browse[page-subtype]`, `ytm-*` on m.youtube.com, `is-shorts`, ARIA
  roles, exact `href`s), never hashed class names. On X the home timeline
  shows only while a chosen timeline is selected, and two signals must agree
  (not the first tab, and a `/home` or `/i/lists/` link); "For you" or any
  layout they cannot place hides it. Never by the tab's text.
- **Shorts.** The static DNR ruleset `shorts-redirect` turns a hard load of
  `https://(www.|m.)youtube.com/shorts/<11-char id>` into
  `https://www.youtube.com/watch?v=<id>`. Chromium refuses to compile a
  counted id followed by an optional tail (the 2 KB regex memory cap; the
  rule is then silently skipped), so the ruleset spells the end of the id as
  three anchored rules: end of URL, `/…` and `?…`. `ShortsRedirectSync`
  enables or disables the ruleset with `updateEnabledRulesets` whenever the
  rule set changes, at start-up and on every YouTube decision, according to
  whether the rule set blocks or hides `youtube.shorts` (updates run one at a
  time). In-app navigations
  to `/shorts/…` (which DNR never sees) are replaced by the watch URL in the
  feed guard.
- **Rule set writes** go through `RulesetStore` only: one promise chain
  serialises read-create and `save`, so creating the starter can never
  overwrite a concurrent save.
- The `e2e` build can delay decisions (`e2e.decisionDelayMs` in
  `storage.local`), names the random attributes on `<html>`
  (`data-mf-e2e-attributes`, `data-mf-e2e-applied`) and opens the shadow
  root, so specs can tamper and look inside; the production bundle drops all
  of it.

## Tracking and local storage (E7)

Focused browsing time is tracked in the service worker, with no content
script on every site (`src/background/tracking`):

- `PulseScheduler` samples on the `pulse` alarm (30 s; 2 s in the `e2e`
  build) and at once on a tab switch, a URL change, a window focus change or
  an idle change (`idle.setDetectionInterval(60)`). Focus moving to
  `WINDOW_ID_NONE` only counts after a 2 s grace (Brave and DevTools report
  it briefly) and then closes the open event at the moment focus left.
- `ActiveTabProbe` turns the active tab of the focused window into a
  heartbeat with `@monki-focus/analytics` `probeTab`: nothing while idle
  unless the tab is audible (`tracking.countAudibleWhileIdle`, default on),
  on a locked screen or on a non-http(s) page. Never the query, fragment or
  (by default) the title.
- `HeartbeatRecorder` merges heartbeats (pulsetime 45 s) and writes every
  change through to IndexedDB; the open event and its row id live in
  `storage.session` (`tracking.openHeartbeat`), so a restarted worker keeps
  extending the same row.
- `AggregationJob` (alarm `aggregate`, every 5 min, on start and before each
  `stats.*` answer) turns events into 5-minute blocks (`categorise` with the
  rule set's categories over the bundled defaults, then `toBlocks`), queues
  changed blocks in the outbox and purges raw events past 30 days.
- `stats.today` / `stats.week` (`src/shared/StatsContract.ts`) read blocks
  by local day in the rule set's pinned `timeZone`;
  `privacy.incognitoAccess` answers `isAllowedIncognitoAccess()`.

IndexedDB `monki` v1 (`src/background/storage/db.ts`, migrations additive):

| Store    | Key                                                                      | Indexes                                                | Kept               |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------ |
| `events` | `id` (auto)                                                              | `bucketTimestamp` `[bucketId, timestamp]`, `timestamp` | 30 days            |
| `blocks` | `[deviceId, blockStart, activityKey ?? '', categoryPath, source, level]` | `blockStart`                                           | without limit      |
| `outbox` | `id` (auto)                                                              | none                                                   | until acknowledged |

The pinned `timeZone` and the category overrides come from E5's
`RulesetStore` (`rules.ruleset`). `browser.storage.local` keys owned here:
`privacy.storeTitles` (default `false`), `tracking.countAudibleWhileIdle`
(default `true`), `device.id` (a random UUID per install) and
`tracking.aggregatedThrough`.

Incognito: when the user allows the extension there, incognito time counts
by domain only (`path` `/`, no surface, never a title); without access it
is not seen at all and the popup warns.

## Intention gate (E6)

When the engine's decision for a page is `gate` (friction) or `block`
(a block rule, a spent budget, bedtime), the tab lands on `gate.html`. Every
state and transition is `@monki-focus/engine`'s (`decide`,
`effectiveEscalationState`, `nextEscalation`); `src/background/gate` stores
what it returns and turns it into the page's view (`src/shared/GateContract.ts`).

- **Redirect.** `GateRedirectRules` keeps one session DNR rule per gated
  escalation group: `main_frame` requests to the group's domains (and their
  aliases, `twitter.com` for `x.com`) redirect with `regexSubstitution` to
  `chrome-extension://<id>/gate.html?t=<ticket>&to=\0` before the request
  leaves. Which domains are gated, and by which group, is `decide` for the
  domain's root page with the stored escalation, so a committed intention or
  an emergency override drops its group's rule and the expiry (or the next
  sync) restores it. Syncs run on start, on every escalation change, on rule
  set changes, at the `decision.validUntil` alarm (schedule edges) and on
  the per-minute `decision.refresh` alarm (budgets that keep accruing). An `engine_error` for any domain keeps the last installed
  rules (never "remove all"; the feed guard already hides every feed).
  After every sync and timer tick, open tabs whose page the engine now gates
  are sent to the gate (timed-out tabs on sites without the feed guard,
  tabs restored after a restart). Verified in Chromium: a DNR redirect to the static
  `chrome-extension://<id>/` URL loads the page although `gate.html` is
  `use_dynamic_url`; `extensionPath` loads too, but it loses the original
  URL (no `tabs.onUpdated` event carries it), so it cannot bring the user
  back to a permalink.
- **Open-redirect guard.** The ticket is a random secret per browser
  session (`storage.session`), written only into the session rule; pages can
  read neither. The gate forwards `{ticket, to}` once (`gate.load`) and
  removes the query from the address bar; the service worker stores `to` as
  the destination of the sending tab only when the ticket matches. Every
  later answer uses the tab's stored destination (`sender.tab.id`), never the
  page's URL, so `gate.html?to=…` opened by anyone else has nothing to
  continue to. `gate.*` commands are answered only from the extension's own
  `gate.html` as the top frame of a tab (static or dynamic id).
- **Passes.** A page the engine allows inside a gated domain (an allowed
  community), or the gate's search box, gets a one-off `allow` session rule
  for that exact URL in that tab (`TabPasses`, never host-wide; URLs over
  1000 characters get none and go through the gate); it is spent once the
  tab has loaded, when the tab closes or after a minute, and the sweep on
  start and on the alarms removes expired and untracked passes. Search only
  works from a friction view.
- **SPA navigations** inside a site: the feed guard's answer for the new URL
  says `gate`/`block` and it sends `gate.open`; the service worker records the
  destination for the tab and `tabs.update`s it to `gate.html`.
- **State.** `EscalationStore` keeps every group's `EscalationState` in
  `storage.local` (`gate.escalation`): pauses, waits, intentions, overrides,
  the counters and `lastFrictionType` survive the worker sleeping and a
  browser restart (SEMANTICS §7), and reloading never resets a pause. The
  per-tab destinations (`gate.tabs`), the ticket, the passes and the words of
  each intention (`gate.intentions`, for the overlay and the "different from
  last time" check) live in `storage.session`. The intention text never
  reaches the engine (only its word count), IndexedDB or the outbox. Every
  stored entry is checked on read (shape here, instants by the engine's own
  `decide` input guard; the rules schema validator compiles with
  `new Function`, which the MV3 CSP forbids) and only invalid entries are
  dropped, with a diagnostic.
  `visit` is fed on the effective state of every matching friction group;
  the matching friction rules come from the engine itself (`decide` with
  each rule alone, `FrictionCandidates`). Budgets: `DailyUsageQuery` sums
  today's tracked web events (E7) per budgeted rule with the engine's
  `normalizeUrl` + `matchesTarget` into `DecisionState.usage`, counting
  only the part of each event inside today (split at local midnight), in
  both zones while a time-zone change waits (the larger wins). When the
  events cannot be read the last good value of the day is kept; without one
  the decision goes ahead without a budget block (diagnostic). Incognito
  time is tracked by domain only (path `/`, no surface), so it accrues to
  site budgets but never to path or surface budgets.
- **Robustness.** Close and Leave close the tab first and record after,
  best-effort; if the service worker cannot answer, the page closes its own
  tab through the tabs API (a new tab first when it is the last one), never
  `window.close()`. One IndexedDB connection (`DbConnection`) is shared and
  a failed open is retried. A wall clock set back behind the last
  escalation event ends active intentions (the engine's `leave`) and
  overrides (the engine's idle state, counters kept) and re-syncs: it fails
  toward friction. Recovered failures leave reason codes in
  `GateDiagnostics`, never a URL or text. An `engine_error` on the gate
  offers "Continue (feeds stay hidden)" and Emergency, as on the site.
- **Timers.** One alarm (`gate.timers`) at the earliest intention or
  override end. The page's own timer shows the overlay on time (alarms can
  run ~30 s late); the alarm restores the redirect and ends what nobody is
  looking at (an intention that ends with no page of its group open counts as
  kept).
- **Emergency.** `emergency_request` from any gating phase (also an active
  intention) → a 2:00 wait with Cancel → 15 minutes; the engine's
  `record_bypass` effect queues a `BypassEvent` in the outbox
  (`kind: 'emergency_override'`, details: the rule group and timestamps,
  never a URL). The override is always granted and always recorded: if the
  outbox cannot be opened the event waits in `storage.local`
  (`gate.pendingBypasses`, drained into the outbox on the next successful
  open); if that fails too, `bypass.unrecorded` is set for the popup. The
  grant is stored after the record attempt, the redirect is re-synced on
  every path, and if the grant cannot be stored the tab gets a pass.
- **Page** (`src/gate`, 02 §8.1): context line (visits today from the
  intention log, minutes today from `stats.today`), the pause (Countdown,
  1px progress, the breath circle, a "why" line per friction type), Close
  (the one accent, enabled and focused from the first frame; closes the tab,
  or opens a new tab first when it is the last one), "What are you here
  for?" (required from L2: ≥ 3 words and different from the previous one),
  5/10/15 with no default, "Continue to <site>" disabled until valid, the
  level line with the engine's next pause, L3's disabled "Ask your guardian"
  (phase 3), Emergency, and a search box on Reddit and YouTube. Blocked
  states offer only Close and Emergency.
- **Timeout overlay and pill** (`src/content`): a closed shadow root (open in
  the e2e build) with the UI kit: "Your N min for «…» are up", **Leave**
  (accent) or "5 more min" with the engine's next pause; media is paused. The
  `mm:ss` pill derives from `expiresAt - now`; `gate.intentionPill` in
  `storage.local` turns it off (default on).
- **Stats.** IndexedDB v2 adds `intentions` (`{at, kind, group}`: visit,
  committed, kept, broken, closed; 30 days), which feeds
  `stats.today.intentions` and the gate's context line.
- **e2e build.** `e2e.clockOffsetMs` in `storage.local` shifts the clock of
  the gate, the decisions and the pages (`RuntimeClock`), so specs skip a
  pause, a 5-minute intention or the 2-minute wait. Specs start from a rule
  set without friction and bedtime unless they ask for `startingRuleset:
'gated'` (`e2e/support/extensionTest.ts`).

## Popup and options (E8)

- **Popup** (360 wide, plan §8.2): the running intention (the gate's
  `GateIntentions`: the active escalation state ending first, its words
  from the session notes; "End now" is the engine's `leave`, kept), Pulse
  today ("—" without data), the level bar with its table view, the top five
  sites, the intentions line, warnings (no incognito access: a way around
  the rules; missing host access, with "Allow" asking for it) and the
  Settings/Statistics footer. There is no on/off switch anywhere.
- **Options** (`options.html#rules|preferences|stats|about`): rule list and
  editor (mode, daily budget, always / work hours / custom times, on/off of a
  rule), allowed Reddit communities (`allow` rules on
  `reddit.com/r/<name>/**`), bedtime, work hours, site levels (category
  overrides), rule set import/export; language, theme, "store page titles"
  (off by default) and "count a playing tab while idle"; the 7-day pulse,
  the hour × weekday heatmap (each with its table), the intentions log (the
  last 7 days of kept, broken and closed facts from the gate's log; no text),
  export (ActivityWatch JSON, CSV of blocks) and "Delete all local data"
  behind an in-page confirmation. It erases history before the current
  local day: today's events, blocks and gate facts (`intentions`)
  stay, so a delete cannot reset a daily budget or today's escalation counts; rules, preferences and bypass records (a later package)
  are never erased.
- **Rule changes** go only through `rules.propose` with the whole edited set
  and the revision the page started from (`stale_revision` otherwise).
  `RuleChangeService` validates it, then runs the engine's
  `effectiveRuleSet(effective, proposed, now, pendingEffectiveFrom, catalog)`:
  the effective set (`rules.ruleset`, written only through
  `RulesetStore.save`) gets what applies today; when anything loosens, the
  whole proposal waits in `rules.pending` with its `effectiveFrom`, an alarm
  (`rules.pending`, plus the per-minute check and every `rules.state` read)
  applies it once due, and `rules.cancelPending` drops it, which never
  loosens anything (it bumps the revision; a waiting time-zone change keeps
  both zones until the cancelled `effectiveFrom`). Editors start from the
  pending set while one waits. A proposal is refused (nothing saved) when it
  exceeds 256 KiB or when the set that would apply today does not validate
  (`too_many_rules`, `invalid_ruleset`). When the stored set itself is
  unreadable, the proposal waits until the latest next local midnight of
  every zone involved (a full day if a zone does not resolve), never
  earlier than a pending change.
- **Validation without eval.** MV3 forbids Ajv's run-time code generation,
  so `config/rulesetValidatorPlugin.ts` compiles the rules package's schemas
  at build time (Ajv standalone, same options) into
  `virtual:monki-ruleset-validator`; `src/shared/RulesetValidation.ts`
  answers the same rejection codes, and a test runs every `invalid` fixture
  through both validators. The same plugin serves
  `virtual:monki-escalation-validator` (`escalation.schema.json#/$defs/state`),
  which checks every stored escalation entry before it reaches the engine
  (`EscalationEntryGuard.ts`, with an engine probe for the instants the
  `date-time` format admits but the engine refuses). Every build and zip ends with
  `config/bundleEvalCheck.ts`, which fails on any `Function(`,
  `new Function` or `eval(` in the output (an E2E spec checks the built
  folders too).
- **Commands for pages only.** `rules.*`, `preferences.*`, `data.*` and
  `intention.*` are answered only when `sender.url` is one of this
  extension's pages (never a content script). Preference writes go through
  `preferences.set` (`ui.theme`, `ui.language`, `privacy.storeTitles`,
  `tracking.countAudibleWhileIdle`, `ui.chartView.<chart>`); every page
  follows theme and language changes live.

## Native bridge to the macOS app (M5)

`src/background/native/` connects the worker to the macOS app through the
native messaging host `dev.monkifocus.bridge` (`monki-bridge`; contract in
`docs/CONTRACTS.md`, "Native messaging"). It needs the optional
`nativeMessaging` permission, which the user grants with "Connect the Mac
app" in the options (Preferences) and can give back there; without it, the
host or the app the extension works exactly as before.

- `NativeBridgeClient` does nothing without the permission (no
  `connectNative`, no timer) and follows `permissions.onAdded`/`onRemoved`.
  With it, it calls `connectNative`, sends `hello` (extension version,
  schema version, browser from `BrowserKind`), and reconnects after every
  disconnect with a 1-60 s jittered backoff (`ReconnectBackoff`), slowing to
  one attempt every 10 minutes after three "host not found" disconnects; any
  alarm catches up a retry whose timer died with the worker.
- `hello.ack { aggregator: "mac" }` sets `bridge.aggregator` in
  `storage.session` (`AggregatorFlag`), but the flag is inert until M6:
  `syncBlocks()` stays true, so the extension keeps queueing its blocks for
  sync (the Mac app has no uploader yet, and a same-user process could forge
  the ack).
- `BridgeActivityForwarder` mirrors each stored heartbeat to the app as
  `browser.activity` (plus the closing heartbeat at a tab switch), with
  exactly what the local store keeps: never a query, a fragment or an
  unrequested title.
- Every message both ways is validated by `BridgeMessageValidator` with
  validators Ajv generates at build time from
  `@monki-focus/protocol/schema/bridge` (`virtual:monki-bridge-validator`);
  an invalid inbound message is ignored, an invalid outbound one is never
  posted. `unlock.token` is handed on unverified (`onPush`) and must be
  verified before it unlocks anything; `rules.snapshot`, `unlock.token` and
  `focusSession.state` are not acted on yet (M6/M7).

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
3. **YouTube** (`www` and `m.youtube.com`): the home grid is gone, the placeholder search opens
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
