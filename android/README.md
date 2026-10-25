# monki-focus for Android

Native Android client: Kotlin, Jetpack Compose, Gradle. Not an npm workspace.
Application id `dev.monkifocus.android` (debug builds add `.debug`), minSdk 29,
targetSdk 36, compileSdk 37.

## Requirements

- **JDK 21** (Temurin recommended). Point `JAVA_HOME` at it.
- **Android SDK** with platform 37, only for the Android modules. Set
  `ANDROID_HOME` or `sdk.dir` in `android/local.properties` (gitignored).
- Nothing else: the Gradle wrapper (pinned version and SHA-256) downloads Gradle.

## Build and test

Run from the repository root (`-p android`) or from `android/`.

```bash
./android/gradlew -p android verify                  # the PR gate (needs the SDK)
./android/gradlew -p android spotlessApply           # format Kotlin and *.gradle.kts with ktlint
./android/gradlew -p android :core-domain:test --tests "*ClockInjection*"
./android/gradlew -p android :app:assembleDebug      # build/outputs/apk/debug/
```

`verify` runs `spotlessCheck`, the `build-logic` tests, `test` on every pure
JVM module, `lintDebug` and `testDebugUnitTest` (Robolectric) on every Android
module, and `:app:assembleDebug`.

### Without the Android SDK

The pure Kotlin/JVM modules build and test with only JDK 21:

```bash
./android/gradlew -p android spotlessCheck :core-domain:test :detectors:test :core-crypto:test
```

AGP 9 resolves the SDK lazily, so configuring the whole build works without
it; only tasks of the Android modules (compile, lint, unit tests, assemble)
fail with "SDK location not found". GitHub Actions validates those on every
pull request (`android` job in `.github/workflows/ci.yml`, ubuntu runners ship
the SDK). That job runs
`./gradlew spotlessCheck lintDebug testDebugUnitTest assembleDebug`; the pure
JVM modules register `testDebugUnitTest` as an alias of `test`, so the shared
fixtures run there too.

## Modules

| Module                   | Kind               | Holds                                                                    |
| ------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `build-logic/`           | included build     | convention plugins `monki.jvm.library`, `monki.android.library`, `monki.android.application`, `monki.android.compose`, `monki.spotless`, `monki.verify` |
| `:core-domain`           | Kotlin/JVM         | models, decision engine, policies, ports. No Android, no I/O, no implicit clock |
| `:detectors`             | Kotlin/JVM         | `UiNode`, detector packs, classifiers; `testFixtures`: `XmlUiNode`        |
| `:core-crypto`           | Kotlin/JVM         | Tink Ed25519 signature verification                                       |
| `:core-data`             | Android library    | Room, DataStore, repositories implementing the domain ports              |
| `:core-ui`               | Android library    | theme, components, **the only string catalog** (`values/`, `values-es/`) |
| `:service-accessibility` | Android library    | accessibility service, overlay host, anti-bypass guard                   |
| `:feature-gate`          | Android library    | friction gate overlay screens                                            |
| `:feature-onboarding`    | Android library    | permission onboarding and the Status screen                              |
| `:feature-stats`         | Android library    | local statistics                                                         |
| `:feature-rules`         | Android library    | rule list, bedtime, JSON import/export                                   |
| `:background`            | Android library    | WorkManager workers                                                      |
| `:app`                   | application        | `MonkiApplication`, `AppGraph` (manual DI), navigation, manifest         |

Kotlin in the Android modules comes from AGP 9's built-in Kotlin support (no
`org.jetbrains.kotlin.android` plugin); `build-logic` pins the Kotlin Gradle
plugin from `gradle/libs.versions.toml` so the compiler version is the catalog's.

## Conventions

- Tests are JUnit4 with spec names (`@Test fun most_specific_rule_wins()`);
  Robolectric only for wiring. `.editorconfig` lets ktlint accept snake_case
  names on `@Test` functions and PascalCase on `@Composable` ones.
- `:core-domain` adds `schema/`, `data/`, `fixtures/` and `detectors/` of
  `packages/rules` to its test resources straight from the package (no copy).
- `:core-domain` ports the decision engine of `packages/engine` one concept
  per file (`dev.monkifocus.android.core.domain.engine`), with models that
  mirror the JSON Schemas (`…domain.rules`, kotlinx.serialization, strict) and
  `RulesetValidator` (networknt 2.0.x on Jackson 2, plus `x-uniqueBy`,
  `x-registrableDomain`, `x-timeZone` and the 256 KiB limit). JUnit4
  `Parameterized` runners run every `decision`, `specificity`,
  `url-normalize`, `schedule`, `escalation`, `rule-change`, `candidates` and
  `invalid` fixture; `RunnerCoverageTest` fails on a kind without a runner.
  Adapters call `decide(…, now = instantOf(clock.millis()), catalog)`; it
  never throws and fails closed (`engine_error`). They re-decide at the
  decision's `validUntil` at the latest, combine escalation with
  `frictionCandidates` + `effectiveEscalationState`, accrue usage to
  `budgetedRulesFor` and check typed intentions with `TypedIntentionRule`
  (`:feature-gate`'s `IntentionRule` delegates to it).
- UI copy only through `core-ui/src/main/res/values{,-es}/strings.xml`; the
  parity test and Lint (`MissingTranslation`, `ExtraTranslation`,
  `HardcodedText` as errors) fail on drift.
- Never log accessibility node text (`scripts/ci/check-android-logging.sh`);
  release builds strip `android.util.Log` with R8.

## Statistics and background work

- `:background` copies the system usage events every 15 minutes and when
  the app opens (`UsageIngestWorker`) into ActivityWatch-style sessions and
  away periods, then into 5-minute blocks with the analytics core; raw events
  are purged after 30 days. `BedtimeWarningWorker` (inexact, no exact alarm)
  and `DetectorPackUpdateWorker` (re-verifies stored packs, no network) run
  through `MonkiWorkerFactory`.
- Browser pages reach the statistics from the accessibility service's URL
  bar as the domain plus a plain first path segment only; a segment with
  `%` or `;`, longer than 64 characters, or read from a domain-only bar is
  dropped.
- **Known gap: private tabs.** No reliable view id for Chrome or Brave
  incognito tabs is known yet, so a private tab's domain is counted like any
  other page on this device (it never leaves the phone). The ids will come
  from the on-device validation (WP 2.12); see `docs/BACKLOG.md`.

## Onboarding, Status and rules

- **Onboarding** (`:feature-onboarding`) is `OnboardingStateMachine`, pure
  and resumable (`OnboardingProgressCodec` in its own preferences file):
  welcome, the accessibility **prominent disclosure** ("I agree" / "Not
  now", which offers statistics only), restricted settings (Android 13+,
  only where the app-op or the installer says the switch may be greyed
  out), notifications, the accessibility service
  (`ACTION_ACCESSIBILITY_DETAILS_SETTINGS` with our component, then the
  list), usage access, battery, device admin, "Turn on protection". No
  system screen opens before the disclosure is accepted; only the
  disclosure, notifications and the service are required; `armedByUser` is
  set by the last step only. The permissions are read again on every resume
  and every second while a step waits on a switch.
- **Battery**: the optional step sends
  `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (the manifest declares the
  permission; allowed for this build, distributed outside Google Play; a Play
  build would drop it and keep the optimisation-list link) and shows the
  maker's steps summarised from dontkillmyapp.com, with a link to its page.
- **Status** is the home screen: protection state, the permission checklist
  with a fix button per missing item (required ones on top), the rules in
  force, "Edit rules", "Turn on protection" while it is not on, and "Exit and
  unlink", always.
- **Rules** (`:feature-rules`): every save goes through `RuleChangeService`,
  the twin of the extension's: `effectiveRuleSet` judges it (tighten now,
  loosen at the next local midnight), the proposal and what applies today
  are validated before anything is stored, a stale screen is refused, a third
  time zone is refused while one waits and the waiting one is never dropped
  early, cancelling bumps the revision. Import and export use the Storage
  Access Framework with the extension's JSON format; an invalid file imports
  nothing and a looser one waits like any edit.
- **Starter preset**: `RuleChangeService.ensureStored` stores the bundled
  starter once (source `preset`), pinned to the device zone of that moment,
  on the first start and when protection is armed; the pinned zone then
  governs, never each process's device zone. A stored set that cannot be
  decoded shows "rules unavailable" on Status and Rules (the service fails
  closed; Exit and unlink still works).
- **Disclosure version**: bumping `OnboardingProgressCodec.DISCLOSURE_VERSION`
  shows the new disclosure to armed users without disarming them; "Not now"
  leads to Exit and unlink.

## Release

The version is `VERSION_NAME` in `gradle.properties`, bumped by release-please
(component `android`). `versionCode = major * 1_000_000 + minor * 1_000 + patch`
(the unreleased `0.0.0` maps to 1, because Android rejects 0).

`assembleRelease` builds an unsigned APK unless `ANDROID_KEYSTORE_PATH` is set;
then `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`
are required too. CI never sets them: the release workflow signs the unsigned
APK with `apksigner` in a separate job. The APK carries no dependency-info
block and no Google Play Services or Firebase.
