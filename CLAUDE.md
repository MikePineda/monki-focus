# monki-focus: agent rules

monki-focus is an open-source (AGPL-3.0-or-later), local-first anti-doomscroll
toolkit: a Chromium MV3 extension, a native Android app, a native macOS
menu-bar app and an optional self-hostable AdonisJS server with a web
dashboard. It is a self-commitment device chosen by its user, with an optional
guardian who approves unlocks and sees only aggregates. It is never DRM and
never monitoring software. Read this file first, then `docs/ARCHITECTURE.md`,
`docs/CONTRACTS.md` and `docs/threat-model.md`.

## Privacy rule (public repo, read before writing anything)

**Never write a real person's name, email, city, phone, employer or any other
personal detail anywhere**: code, comments, docs, fixtures, examples, test
data, screenshots, branch names or commit messages. Use roles: "the user",
"the guardian", "the maintainer". Copyright is "monki-focus contributors".

- The GitHub owner handle may appear **only** inside repo and registry URLs
  (`https://github.com/MikePineda/monki-focus`,
  `ghcr.io/mikepineda/monki-focus-server`). Never in app ids, package names,
  text or examples. App ids use `dev.monkifocus.*` (`dev.monkifocus.android`,
  `dev.monkifocus.mac`, native host `dev.monkifocus.bridge`).
- Fixtures are synthetic with the real structure. Android UI dumps are
  sanitised before they are committed. Example locations, schedules and time
  zones are generic.
- `docs/internal/` is gitignored and holds private notes with real names.
  Never copy text from it into tracked files without scrubbing it, and never
  `git add -f` anything under it.
- Before every push, gitleaks and `scripts/ci/privacy-pre-push.sh` run via the
  lefthook `pre-push` hook (patterns come from a local, gitignored file and
  from the `PRIVACY_PATTERNS` CI secret — never write them into the repo).

**Owner Q&A lives in `docs/internal/QA.md` and the plan in
`docs/internal/PLAN-*.md` plus `docs/internal/plan/` (local-only, gitignored):
read the plan section for a package and QA.md before starting each work
package.** On a fresh clone these files do not exist; work from `docs/`.

New ideas mid-session go to `docs/BACKLOG.md` as a dated one-liner, then you
continue with the work in progress.

## Repo map

| Path                     | What                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `packages/rules`         | `@monki-focus/rules`: JSON Schemas, site profiles, surfaces, default categories, shared fixtures. |
| `packages/engine`        | `@monki-focus/engine`: pure TS decision engine and analytics core (extension and server).         |
| `packages/protocol`      | `@monki-focus/protocol`: device API `openapi.yaml`, PASETO v4.public token schemas and vectors.   |
| `packages/design-tokens` | `@monki-focus/design-tokens`: semantic light/dark tokens for every client.                        |
| `extension/`             | Chromium MV3 extension (WXT, Vite, Preact, Vitest, Playwright).                                   |
| `android/`               | Kotlin app (Gradle, Compose, JUnit4 + Robolectric, Spotless + ktlint). Not an npm workspace.      |
| `macos/`                 | Swift menu-bar app (XcodeGen, `Packages/MonkiCore`, `Packages/MonkiPlatform`, Swift Testing).     |
| `server/api`             | AdonisJS server (Postgres, Lucid, Japa), ntfy for guardian notifications.                         |
| `server/web`             | Angular dashboard (Vitest).                                                                       |
| `e2e/`                   | Playwright journeys across dashboard, extension and server.                                       |
| `docs/`                  | Architecture, contracts, threat model, runbook, backlog, ADRs, `design/`.                         |

## Non-negotiables

- **English** for code, comments, docs, commit messages and skills. UI copy
  only through i18n catalogs (`en` and `es`) on every platform (extension
  catalogs, Android `values/` + `values-es/`, macOS `Localizable.xcstrings`,
  dashboard catalogs), each with a **parity test** that fails on any missing
  key. Never hardcode user-facing copy; domain code returns keys and reason
  codes, never text.
- **TDD.** The test comes first and its name reads like a spec
  (`hide_feed_never_blocks_a_permalink`). Every business rule is born with its
  test. Shared behaviour is a fixture in `packages/rules` or
  `packages/protocol` and every platform runs it.
- **Pure domain modules.** Decision, escalation, analytics, token
  verification and policy logic take the clock (wall and monotonic) and all
  inputs as parameters: no I/O, no framework imports, no implicit `now`.
  Platform code is a thin adapter.
- **One concept per file**, named after the concept (`EscalationStore.ts`,
  `DecisionEngine.kt`, `PulseCalculator.swift`). No `utils`, `helpers`,
  `common` or `misc` files.
- **Design tokens only.** Colours, type and spacing come from
  `packages/design-tokens` semantic tokens, with light and dark themes on
  every client. No raw hex values in components.
- **Anti-stalkerware is a hard requirement.** No hidden mode, no hidden icon,
  no remote commands, guardian sees only the documented DTO (score, unlocks,
  bypasses; never URLs or titles), leaving is always possible from the
  device. Anything else is a high-severity bug (`SECURITY.md`).
- **Migrations are additive.** Add columns and tables; drop or rename only in
  a later release. Applies to Postgres, Room and GRDB.
- **Secrets only in env or the deploy panel**, validated at boot. Signing keys
  never in the database in clear, never in logs. Never log tokens, pairing
  codes, capabilities, URLs, titles or accessibility node text.
- **Tenant isolation:** every server resource hangs from the user; a guardian
  reaches data only through an active guardianship; another user's id answers
  **404, never 403**.
- **Conventional Commits + DCO.** Allowed scopes are listed in
  `commitlint.config.mjs` (`rules`, `engine`, `protocol`, `design-tokens`,
  `extension`, `android`, `macos`, `server`, `web`, `e2e`, `ci`, `deps`,
  `docs`, `repo`, `security`). Every commit is signed off with
  `git commit -s`; agents add their trailer with
  `git commit -s --trailer "Co-Authored-By: …"` so the sign-off comes first.
  commitlint runs in the `commit-msg` hook and in CI. release-please versions each component
  separately and owns every `CHANGELOG.md`: never edit them by hand. Extra
  type: `security`.
- **SPDX header** `SPDX-License-Identifier: AGPL-3.0-or-later` on new source
  files.
- **No PR without `npm run verify` green.**

### Laravel to the test stacks

TypeScript (Vitest for extension, engine and web; Japa for the server):

| Laravel                      | Here                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `RefreshDatabase`            | Japa: migrate once per suite + global transaction per test; extension: `fake-indexeddb/auto` |
| `postJson()->assertStatus()` | `client.post(url).json(body).loginAs(user)` then `response.assertStatus()`                   |
| `assertDatabaseHas`          | `db.assertHas('table', {...})` (Japa `dbAssertions`); extension: `expectStored(repo, {...})` |
| factories                    | Lucid factories with states; `makeRule()`, `makeEvent()` in `tests/factories/`               |
| `actingAs`                   | `.loginAs(user)`; device routes with a device token factory                                  |
| `Carbon::setTestNow`         | injected `Clock` (`fixedClock('2026-01-05T09:00:00Z')`)                                      |
| `Http::fake` / `Event::fake` | `fakeBrowser` from `wxt/testing`; fake ports for native messaging; fake LLM provider         |
| data providers               | `describe.each(loadFixtures('decision'))`                                                    |
| Dusk                         | Playwright (`e2e/`, `extension/e2e`)                                                         |

Kotlin (JUnit4, Robolectric only for wiring):

| Laravel                              | Here                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `php artisan test --filter X`        | `./gradlew :core-domain:test --tests "*MostSpecific*"`                        |
| spec-style test name                 | `@Test fun most_specific_rule_wins()`                                         |
| `RefreshDatabase`                    | fresh `Room.inMemoryDatabaseBuilder` per test under Robolectric               |
| factories with states                | builders in `testFixtures` (`aRule(mode = BLOCK) { site("example.com") }`)    |
| `Carbon::setTestNow`                 | `Clock.fixed(...)` / `MutableClock`, `FakeMonotonicClock`                     |
| data providers                       | JUnit4 `Parameterized` over the shared fixtures                               |
| `Notification::fake` / `Event::fake` | recording fakes of the ports (`RecordingNotifier`, `RecordingBypassReporter`) |
| `Queue::fake`                        | `TestListenableWorkerBuilder` + `WorkManagerTestInitHelper`                   |
| Dusk                                 | Compose UI tests (`createComposeRule`) under Robolectric                      |

Swift (Swift Testing; XCTest only for XCUITest smoke):

| Laravel              | Here                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| spec-style test name | `@Test("most specific rule wins")` with `#expect`                    |
| data providers       | `@Test(arguments: fixtures)` reading shared fixtures via `#filePath` |
| `RefreshDatabase`    | in-memory GRDB `DatabaseQueue()` per test                            |
| `Carbon::setTestNow` | injected `FixedClock` and a fake monotonic clock                     |
| `Event::fake`        | protocol-backed fakes for watchers, notifications and the bridge     |

## Security review required

A read-only security reviewer must approve before merge when a change touches:
unlock tokens or crypto · pairing, capabilities or guardianship · server routes
(every PR) · rules or policy signing · Android accessibility and anti-bypass ·
native messaging or the bridge · the LLM or digest · CI workflows. Checklists
are in `docs/threat-model.md` §4.

## Working mode: master agent + Opus 5.5 subagents

The implementing session acts as **master**: it decides, cuts work into
packages, writes briefs, launches subagents, integrates, runs `npm run verify`,
talks to the owner and keeps memory. It does not write feature code beyond
one-line integration fixes.

Each **subagent** gets one self-contained package (`Agent`,
`subagent_type: general-purpose`, `model: "opus"`; never `fork`, which would
inherit the master's whole context). Independent packages run in parallel with
`isolation: "worktree"`; packages touching the same files run in series.
Subagents push their branch and never use `gh`; the master opens and merges PRs.

A brief contains only: (1) goal and done criterion; (2) minimal context (this
file, `docs/ARCHITECTURE.md`, the plan section, files to touch, references);
(3) the contract copied from the plan; (4) rules (TDD, English, privacy rule,
Conventional Commits with sign-off, stay inside the package); (5) mandatory
verification command; (6) report format, at most 25 lines. The master reads
reports, not full diffs (reviews go to a reviewer subagent or `/code-review`).
If a subagent fails twice, the master rereads the affected files and rewrites
the brief, not the code.

## How to run

Node 24 (`nvm use`). Android needs JDK 21 and the Android SDK; macOS needs
Xcode 26 and XcodeGen; the server needs Docker.

```bash
npm install            # dependencies + git hooks (commitlint, DCO sign-off)
npm run verify:quick   # lint + typecheck + test + build for changed components
npm run verify         # the PR gate (adds E2E)
npm run verify:all     # every component, changed or not
npm run format         # prettier (format:check in CI)
```

Today `scripts/verify.mjs` only runs `turbo run lint typecheck test build`;
component detection and the Android, macOS and E2E layers land in WP 0.7.

## Known traps (each one already cost time)

- **commitlint's `signed-off-by` rule demands sign-off as the very last
  line**, so it rejects a `Co-Authored-By` placed after it. The config uses
  `trailer-exists` instead. `git commit -s` with the trailer inside `-m`
  duplicates the sign-off; use `--trailer` for extra trailers.
