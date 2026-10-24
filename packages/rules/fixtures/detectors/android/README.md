# Android UI dump fixtures

`<package>/<appVersion>/<surface>-NN.xml` is a uiautomator dump (or the debug
capture of the app, same format) and `<surface>-NN.expect.json` its expected
outcome. The Kotlin `:detectors` tests replay every dump through the bundled
packs of `detectors/android/`.

```json
{
  "surface": "instagram.reels",
  "basis": "view_id",
  "guarded": "guard.app_info",
  "urlBar": "shown",
  "urlText": "example.org",
  "androidApi": 35,
  "device": "generic",
  "capturedAt": "2026-10-25",
  "synthetic": true
}
```

- `surface`: what the stateless `SurfaceClassifier` returns (`null`: nothing
  recognised; `DmReelSession` may still turn a `reel_from_dm` into `reels`);
  `basis` (optional): the deciding tier, `view_id` or `label`.
- `guarded` (Settings and package-installer dumps): what
  `SettingsScreenClassifier` returns with our app label `monki-focus`.
- `urlBar` / `urlText` (browser dumps): `shown` with the raw URL text,
  `editing` (focused bar, nothing read) or `absent`.
- `device` is always `generic`: never a personal device name.

`synthetic/` holds hand-built dumps with the real structure and view ids of
the reference projects (`android/NOTICE`) and placeholder text. Real captures
go in a folder named after the app's `versionName`, sanitised first:

```bash
node packages/rules/scripts/sanitize-uidump.mjs capture.xml \
  packages/rules/fixtures/detectors/android/<package>/<versionName>/<surface>-01.xml
node packages/rules/scripts/sanitize-uidump.mjs --check packages/rules/fixtures/detectors/android/*/*/*.xml
```

Labels a pack compares (`Reels`, `Home`, …) survive only when listed in
`label-allowlist.json`; `--keep` adds labels for one run, but the tests accept
only the committed allowlist.
