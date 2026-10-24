# Android detector packs

Detector packs classify an Android screen (the accessibility tree of the
foreground app) into a surface from `data/surfaces.json`, so that a surface
rule such as `youtube.shorts → block` has the same effect in the app and on the
web. Schema: [`schema/v1/detector-pack.schema.json`](../../schema/v1/detector-pack.schema.json).
The Android `:detectors` module evaluates them (`SurfaceClassifier`,
`BrowserUrlExtractor`, `SettingsScreenClassifier`, `DetectorPackLoader`).

| Pack                 | Packages                                                          | Classifies                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `instagram.pack.json` | `com.instagram.android`                                           | `instagram.reel_from_dm` (100) > `instagram.reels` (90) > `instagram.stories` (80) > `instagram.direct` (70) > `search` > `explore` > `home` |
| `youtube.pack.json`   | `com.google.android.youtube`                                      | `youtube.shorts` (player ids, then the selected "Shorts" tab), `youtube.home`                                                               |
| `browsers.pack.json`  | Chrome, Brave, Vivaldi, Cromite, Vanadium, Firefox, Samsung       | no surfaces: `urlBarViewIds` in fallback order (`url_bar`, `omnibox_url_text`, …); the engine normalises the URL                           |
| `settings.pack.json`  | `com.android.settings`, package installers                        | `guard.*` screens for anti-bypass: device admin, accessibility detail, App info, uninstall dialog                                          |

Every `*.pack.json` placed here is validated against the schema by
`npm test -w @monki-focus/rules`; the Kotlin tests replay the UI dumps of
`fixtures/detectors/android/` through the bundled packs.

## Predicates

A predicate matches **one node**; every field it names must hold on that node.

| Field               | Meaning                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `viewId`            | Resource id. Short ids are prefixed with the screen's package (see below).                    |
| `contentDesc`       | Content description equals this literal (case-sensitive).                                     |
| `contentDescPrefix` | Content description starts with this literal.                                                 |
| `text`              | Node text equals this literal (case-sensitive).                                               |
| `className`         | Widget class equals this literal.                                                             |
| `onScreen`          | `true`: visible to the user with a non-empty area inside the screen; `false`: the opposite.   |
| `selected`          | The node's selected flag.                                                                     |
| `minHeightRatio`    | Node height ≥ ratio × screen height (keeps the Shorts shelf on Home from reading as Shorts). |

A detector applies when every `all` predicate, at least one `any` predicate
(when present) and no `none` predicate match some node of the screen.
Detectors run by descending `priority`, ties by surface id; the first one that
applies wins. A surface may have several detectors (alternative signals).

- **Short view ids** (`clips_viewer_view_pager`) become
  `<package>:id/clips_viewer_view_pager` for the package on screen, which also
  covers repackaged variants listed in `packages`. Only the compiled Compose
  test tags (`ADDRESSBAR_URL_BOX`) also match a resource id without a package.
  Qualified ids (`android:id/switch_widget`) are used as is. Nodes of another
  package and anything below a WebView are never candidates.
- **Tiers.** View-id detectors sit above label (content description / text)
  fallbacks, which carry per-language lists (`Home`, `Inicio`) and always name
  a view id too. The classifier reports which tier decided (`VIEW_ID` or
  `LABEL`) as a reason code: a pack that only matches through labels hints at
  renamed ids.
- **Allow-only surfaces** (`*.reel_from_dm`, `*.stories`, `*.direct`) need the
  compiled evidence in every detector (`reel_from_dm`: a sender id in `all`, a
  reply-bar id, the `suggested_title` veto), never match on a truncated read,
  and a `reel_from_dm` must follow the inbox within 5 s and lasts at most
  120 s (`DmReelSession`); otherwise it is `reels`.
- **Safety net.** `unclassifiedCapMinutes` (SEMANTICS.md §11): when a package
  has an enabled surface `block` rule and its screens were unclassified for at
  least the cap within the last 2 × cap minutes (sliding window), app-level
  friction applies (Instagram and YouTube: 10, at least 5 by compiled rule).
- **Traversal.** At most 2,500 nodes and 40 levels per screen read, breadth
  first.
- **Settings.** `guard.*` surfaces only describe a screen's shape. The app
  guards one only when its own label (app or service name, from its resources
  in the device language) is on screen, so the same screens of other apps,
  and the accessibility list itself, keep working. Uninstall and device-admin
  screens that show a package name must show ours, and App info, uninstall
  and device admin are not guarded when another installed package or active
  admin shares one of our labels (the caller checks with `PackageManager`).

## Rules for packs

- **Data only.** Literal comparisons of view ids, content descriptions, text
  and class names, plus `onScreen`, `selected` and `minHeightRatio`. No regex,
  no scripting, nothing executable.
- **Versioning.** `packVersion` is CalVer `YYYY.MM.DD.n` (a real calendar
  date), compared numerically per component. A downloaded pack is accepted
  only when it is at most 256 KiB, signed (strict Ed25519 over the exact file
  bytes, offline `rules-signing` key, the public key compiled into the app),
  free of duplicate JSON keys, valid against the schema, needs a supported
  `minSchemaVersion`, names only packages of the compiled allowlist for its
  `packId`, holds the compiled invariants (family, registered surfaces, all
  four `guard.*` screens, safety net, allow-only evidence), is not revoked, is
  dated at most 2 days ahead, and is strictly newer than both the installed
  pack and the version bundled with the build. Bump `packVersion` and the
  compiled minimum together. The APK always carries the bundled packs as the
  fallback; a stored download is re-verified on every start.
- **Privacy.** UI dump fixtures are synthetic or sanitised with
  `scripts/sanitize-uidump.mjs`: every `text` and `content-desc` becomes `⟨t⟩`
  except the labels of `fixtures/detectors/android/label-allowlist.json` and
  URLs on reserved example hosts. Tests fail on any other text.

## Status

`testedAppVersions` is empty on purpose: the fixtures under `synthetic/` are
modelled on the reference projects listed in `android/NOTICE` (real view ids,
placeholder text), not captured from a device. Real captures land per app
version (`<package>/<versionName>/`) during on-device validation, and ids
marked unverified there are corrected with a `packVersion` bump. Unverified
today: Instagram `direct`, `search` and `explore` ids; the YouTube tab id
`pivot_bar_item_tab`, its labels and `selected` flag; Settings and
package-installer ids per Android version.
