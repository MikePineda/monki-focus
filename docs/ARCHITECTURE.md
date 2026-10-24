# Architecture

monki-focus is a polyglot monorepo with one product spread over four
platforms: a Chromium MV3 browser extension, a native Android app, a native
macOS menu-bar app and an optional self-hostable server with a web dashboard.
The platforms share **data contracts and fixtures**, not code: the rules, the
decision semantics, the analytics model and the unlock-token format are
specified once and every platform proves conformance against the same files.

## Principles

- **Local first.** Every client enforces rules and keeps its analytics with no
  server. The server adds guardian approvals, sync across devices, a dashboard
  and an optional weekly report.
- **Commitment, not DRM.** Bypassing is always possible for the owner of the
  device, but deliberate and visible: it produces a bypass event that the
  guardian sees. See [threat-model.md](threat-model.md).
- **Pure domain, thin adapters.** Decision, escalation, analytics and token
  verification are pure functions that take the clock and inputs as
  parameters. Platform code (browser APIs, Android accessibility, AppKit,
  HTTP) only gathers inputs and applies decisions.
- **One vocabulary.** Rules target apps, sites or _surfaces_ (for example
  `youtube.shorts`), and surfaces resolve the same way in the app (through a
  detector) and on the web (through a site profile).

## Repository layout

| Path                     | Package / build                    | Role                                                                                                                                             |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/rules`         | `@monki-focus/rules` (npm)         | JSON Schemas (rule set, target, schedule, surfaces, site profiles, detector packs), default categories, conformance fixtures, generated TS types |
| `packages/engine`        | `@monki-focus/engine` (npm)        | Pure TypeScript decision engine and analytics core, run against the fixtures                                                                     |
| `packages/protocol`      | `@monki-focus/protocol` (private)  | Device API `openapi.yaml`, unlock and policy token schemas, PASETO test vectors                                                                  |
| `packages/design-tokens` | `@monki-focus/design-tokens` (npm) | Semantic light/dark tokens exported to CSS, Android and Swift                                                                                    |
| `extension/`             | npm workspace (WXT + Vite)         | Chromium MV3 extension (Brave and Chrome first)                                                                                                  |
| `android/`               | Gradle (not an npm workspace)      | Kotlin app; pure `:core-domain` and `:detectors` modules plus Android modules                                                                    |
| `macos/`                 | XcodeGen + Swift packages          | Menu-bar app, `MonkiCore` (pure) and `MonkiPlatform` packages, `monki-bridge` helper                                                             |
| `server/api`             | npm workspace (AdonisJS)           | Optional server: accounts, devices, guardianship, unlocks, analytics, LLM jobs                                                                   |
| `server/web`             | npm workspace (Angular)            | Dashboard for the user and the guardian                                                                                                          |
| `e2e/`                   | npm workspace (Playwright)         | Cross-component journeys                                                                                                                         |

Android and macOS are not npm workspaces; they read
`packages/*/fixtures` and data files by relative path.

## Components

### Rules (`packages/rules`)

A user's **rule set** is a versioned JSON document: rules (target, mode
`allow | hide-feed | friction | block`, schedules, optional daily budget),
category assignments and a bedtime. Targets are an app package, a site
(domain plus optional path glob) or a surface. Site profiles map URL paths to
surfaces of kind `feed`, `permalink` or `utility`, so "hide the feed but never
block a shared post" is data, not per-platform code.

Decisions run on **two axes**:

- `access`: `allow | gate | block`, resolved from `allow`, `friction` and
  `block` rules;
- `content`: `show | hide-feed`, resolved from `hide-feed` rules (and `allow`
  on a surface).

On each axis the most specific matching rule wins (refinement, literal path
segments, domain labels, fewer wildcards, then the stricter mode). State
overlays apply on top of `access` in order: bedtime, exhausted budget, active
intention or friction step. Unlocks that have been verified upstream can lift a
block. The engine returns reason codes and i18n keys, never text.

Rules downloaded from the project feed are pure data, signed offline,
monotonically versioned and size-limited; clients keep the last valid set when
verification fails.

### Decision engine (`packages/engine`)

`decide(rules, context, now)`, `nextEscalation(state, event, now)` and
`effectiveRuleSet(current, proposed, now, timeZone)` (loosening applies the
next local day, tightening applies at once), plus the analytics core. No
browser APIs, no I/O, no `Date.now()`. The Kotlin (`:core-domain`) and Swift
(`MonkiCore`) ports run the same fixtures.

### Browser extension (`extension/`)

A service worker owns all state through a single command router. It hides
feeds per surface with selectors that live only in the extension, redirects
Shorts with a static declarative rule, sends gated navigations to an
extension-owned intention page (the destination is kept per tab in session
storage, never read from a query parameter), escalates friction on repeated
attempts and records activity heartbeats. With the macOS app installed it
talks to the native messaging bridge for trusted time and policy.

### Android app (`android/`)

An accessibility service limited to the target packages classifies the
current screen into a surface through declarative detector packs, asks the
decision engine and acts (cover, back, overlay with the intention flow).
Usage statistics feed the local analytics. Anti-bypass is friction plus
detection: the app watches for its own settings screens, accessibility being
disabled and clock changes, and reports them. Manual dependency injection;
JUnit4 with Robolectric for tests.

### macOS app (`macos/`)

A menu-bar app (no sandbox) that watches the frontmost app and idle time,
gates or hides distracting apps, enforces bedtime and runs focus sessions. A
small `monki-bridge` helper is the native messaging host for Brave and Chrome;
it relays to the app over a local Unix socket (mode 0600, peer-validated) with
a minimal five-method API.

### Server and dashboard (`server/`)

An optional AdonisJS server with Postgres. It enrols devices, receives
heartbeats and activity blocks, manages guardian links, issues signed unlock
tokens and signed policies, raises dead-man alerts when heartbeats stop, and
runs scheduled jobs (in-process scheduler, see
[ADR 0004](adr/0004-in-process-scheduler.md)). Guardians receive unlock
requests through a self-hosted ntfy with single-use capability actions (see
[ADR 0003](adr/0003-ntfy-capability-actions.md)). The Angular dashboard serves
both the user (full own data) and the guardian (aggregate view only).

## Data flows

### Gate and unlock

1. A client hits a gated or blocked target; the engine returns
   `gate` with an escalation level or `block`.
2. At the top escalation level, or for a block, the user can ask the
   guardian. The client sends an unlock request to the server.
3. The server publishes a notification to the guardian's ntfy topic with
   approve and deny actions (single-use, short-lived capabilities).
4. On approval the server signs a **PASETO v4.public** unlock token bound to
   the instance and the device (see
   [ADR 0002](adr/0002-paseto-v4-unlock-tokens.md)); the client fetches it by
   long-poll.
5. The client verifies the token offline (pinned key, implicit assertion,
   monotonic clock anchor, replay store) before the engine sees it.

An **emergency override** works offline: a two-minute wait, fifteen minutes of
access, and a bypass event that is always reported (queued until online).

### Heartbeat and dead-man switch

Clients send periodic heartbeats with protection state, policy hash and risk
signals. Missing heartbeats past a threshold, a disabled accessibility
service, a policy mismatch or a clock change become bypass events, and the
guardian is notified.

### Analytics

- **Events** follow the ActivityWatch bucket and event model (window, AFK, web
  tab, app usage), merged by heartbeat with a pulse time.
- **Categorisation** maps each activity key (domain or app id) to a category
  level: Distracting 0, Personal 25, Neutral 50, Other work 75, Focus 100.
  Uncategorised activity is Neutral.
- **Pulse** (focus score) = time-weighted mean level over non-idle time, 0 to
  100; `null` when nothing was tracked.
- **5-minute blocks** (`deviceId`, `blockStart`, `activityKey?`,
  `categoryPath`, `level`, `seconds ≤ 300`) are the only analytics that sync.
  On the Mac, browser time covered by extension events is subtracted from the
  browser app's time; across devices the server caps each block at 300
  seconds.
- Days and weeks are computed in the user's time zone. Export uses the
  ActivityWatch format.
- The guardian sees only per-level totals and the pulse; titles and URLs
  never leave the device.

## Cross-platform conformance

| Contract                      | Source of truth                      | Consumers                          |
| ----------------------------- | ------------------------------------ | ---------------------------------- |
| Rule set schema and semantics | `packages/rules/schema`, `fixtures/` | engine (TS), Kotlin, Swift, server |
| Analytics fixtures            | `packages/rules/fixtures/analytics`  | engine (TS), Kotlin, Swift, server |
| Unlock and policy tokens      | `packages/protocol` vectors          | extension, Android, macOS, server  |
| Device API                    | `packages/protocol/openapi.yaml`     | all clients, server tests          |
| Native messaging              | `macos` bridge contract              | extension, macOS app               |

See [CONTRACTS.md](CONTRACTS.md) for the list and status of each contract.
