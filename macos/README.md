# monki-focus for macOS

Native menu-bar app: Swift 6, SwiftUI, macOS 14 (Sonoma) or later. Bundle id
`dev.monkifocus.mac`. It has no Dock icon (`LSUIElement`) but its menu-bar
icon is always visible, and **Quit** is always one click away in the panel.

Status: work packages M1 (scaffold), M2 (decision engine), M3 (analytics
core) and M4 (watchers and storage). The "Today" panel and Settings window are
placeholders; the bridge relay, sync and blocking arrive in M5-M9.

- **M2, decision engine** (`MonkiCore/Sources/MonkiCore/Engine`, `Rules`,
  `Validation`): `decide`, escalation, rule changes, schedules and bedtime,
  URL normalisation and rules validation, a port of `packages/engine`.
- **M3, analytics core** (`MonkiCore/Sources/MonkiCore/Analytics`): heartbeat
  merging, active time (AFK), tab probing, categorisation, the focus pulse,
  5-minute sync blocks, daily totals, browser dedupe, the cross-device cap
  and ActivityWatch export, a port of `packages/analytics` (one file per
  TypeScript file). It reuses the engine's URL normalisation, target
  matching, specificity and category ranking (`mostSpecificAssignment`, also
  behind `decide`'s bedtime level), zoned time and strict instants.

- **M4, activity capture** (`MonkiCore/Sources/MonkiCore/Capture`, pure, and
  `MonkiPlatform/Sources/MonkiPlatform/Capture` + `Storage`): the window
  watcher (frontmost app; the focused window title only when the user turned
  titles on, off by default, and granted Accessibility), the AFK watcher (idle
  time every 5 s, 180 s threshold; sleep, display sleep, lock and session
  switches force AFK), the heartbeat queue (ActivityWatch pulsetime merge,
  batch writes every 10 s and at sleep, AFK and quit) and the GRDB buckets and
  events tables. Each observation is a heartbeat that starts at the previous
  one, so consecutive events of a bucket touch and never overlap
  (`StateHeartbeatEmitter`, proven by seeded property tests).

Both run every shared fixture of `packages/rules/fixtures` (all kinds except
`unlock-token`, which the token verifier will run), plus seeded property tests.

## Requirements

- **Xcode 26.x** (Swift 6.2). Xcode 27 needs macOS 26.6 or later and is not required.
- **XcodeGen 2.46.0**, installed with the same pinned, checksum-verified
  script CI uses (no Homebrew needed):

  ```bash
  RUNNER_TEMP="$HOME/.cache/monki-focus" bash scripts/ci/install-xcodegen.sh
  export PATH="$HOME/.cache/monki-focus/xcodegen-2.46.0/xcodegen/bin:$PATH"
  ```

  The script prints the `bin` directory to add to `PATH`. Bump the version
  and the SHA-256 in the script together.

## Build and test

`MonkiFocus.xcodeproj` is generated from `project.yml` and gitignored: run
`xcodegen generate` after pulling or after adding, moving or removing files.

```bash
# Pure domain and adapters (no Xcode project needed), from the repository root
swift test --package-path macos/Packages/MonkiCore
swift test --package-path macos/Packages/MonkiPlatform

# The app (exactly what the CI `macos` job runs), from macos/
cd macos
xcodegen generate
xcodebuild test -scheme MonkiFocus -destination 'platform=macOS' CODE_SIGN_IDENTITY=-

# Format and lint (CI runs the lint with --strict because .swift-format exists)
xcrun swift-format format --in-place --recursive macos
xcrun swift-format lint --strict --recursive macos
```

The `MonkiFocus` scheme tests the app target and `MonkiPlatformTests`.
`MonkiCoreTests` run only with `swift test`: they read the shared fixtures
from the checkout, and a test process that xcodebuild launches hangs on a
privacy prompt when the checkout is under `~/Documents` or `~/Desktop`.
Tests use Swift Testing
(`@Test("spec name")`, `#expect`); XCTest is reserved for XCUITest smoke tests.

## Layout

| Path                         | What                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `project.yml`                | XcodeGen spec: targets, scheme `MonkiFocus`, package references.                          |
| `Config/Base.xcconfig`       | Shared settings: Swift 6, strict concurrency `complete`, macOS 14, hardened runtime, ad-hoc signing. |
| `Config/Version.xcconfig`    | `MARKETING_VERSION`, owned by release-please (component `macos`).                        |
| `App/`                       | `MonkiFocus.app`: `MenuBarExtra` ("Today" panel) and the `Settings` scene.                |
| `App/Resources/Localizable.xcstrings` | The only string catalog (`en`, `es`).                                          |
| `Bridge/`                    | `monki-bridge`, the native messaging host, embedded at `MonkiFocus.app/Contents/Helpers/`. |
| `AppTests/`                  | App tests: string-catalog parity, design-token colours, the embedded bridge binary.      |
| `Packages/MonkiCore`         | Pure domain (decision engine and analytics core): no AppKit, no SwiftUI, no I/O, no implicit clock. `MonkiCoreTesting` holds fakes (`FixedClock`, `FakeMonotonicClock`) and shared-fixture access. |
| `Packages/MonkiPlatform`     | Adapters: system clocks, activity watchers behind protocols (`SessionEventSource`, `ApplicationActivationSource`, `IdleTimeSource`, `RepeatingTimerScheduler`, ...), GRDB storage (GRDB 7.11.1, pinned exactly; `Package.resolved` committed) in `~/Library/Application Support/monki-focus/activity.sqlite` (0600, WAL). |

## Conventions

- **Clocks are injected.** Domain code takes a `Clock` (wall) and a
  `MonotonicClock`; a test (`clock is injected, not implicit`) scans the
  MonkiCore sources for `Date()`, `Date.now` and other implicit time reads.
  The real clocks (`SystemClock`, `SystemMonotonicClock`) live in MonkiPlatform.
- **Shared fixtures** come straight from `packages/rules/fixtures` through
  `SharedFixtures` / `RepositoryPaths` (resolved from `#filePath`), for use with
  `@Test(arguments: try SharedFixtures.files(kind: "decision"))`.
- **Design tokens** are compiled from `packages/design-tokens/dist/macos/*.swift`,
  listed as a source folder of the app target (never copied or edited here).
  Views use `Color.monkiSurface1`, `MonkiTypography.body.font()`,
  `MonkiSpacing.spaceMd`; light and dark follow the system appearance.
- **Copy only through `Localizable.xcstrings`**, keyed (`today.title`), with a
  translated `en` and `es` value for every key. The parity test fails otherwise.
- **The app tests never read the checkout at run time.** They run inside the
  app, and an app opening files under `~/Documents` triggers a privacy prompt
  that hangs the run; `project.yml` copies their inputs into the test bundle.
- **Migrations are additive** (`MonkiDatabaseMigrator`): never edit a shipped
  migration, never erase the database on a schema change.
- Every source file starts with `// SPDX-License-Identifier: AGPL-3.0-or-later`.

## Installing a release build (Gatekeeper)

Release builds are signed **ad-hoc** (no Apple Developer ID, no notarization),
so macOS refuses to open them at first:

1. Move `MonkiFocus.app` from the DMG to `/Applications` and open it once; macOS
   says it cannot verify the developer.
2. Open **System Settings > Privacy & Security**, scroll to the message about
   MonkiFocus and click **Open Anyway**, then confirm.

Alternatively, remove the quarantine attribute after reading the release
notes: `xattr -dr com.apple.quarantine /Applications/MonkiFocus.app`.

An ad-hoc signature changes with every build, so macOS may ask again for
permissions such as Accessibility after an update.
