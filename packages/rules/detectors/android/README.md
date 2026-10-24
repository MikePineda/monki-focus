# Android detector packs

Detector packs classify an Android screen (the accessibility tree of the
foreground app) into a surface from `data/surfaces.json`, so that a surface
rule such as `youtube.shorts → block` has the same effect in the app and on the
web. They arrive with the Android work package; only the schema exists today:
[`schema/v1/detector-pack.schema.json`](../../schema/v1/detector-pack.schema.json).

Planned files: `instagram.pack.json`, `youtube.pack.json`, `browsers.pack.json`
(URL bar view ids per browser) and `settings.pack.json` (guarded settings
screens). Every `*.pack.json` placed here is validated against the schema by
`npm test -w @monki-focus/rules`.

## Rules for packs

- **Data only.** Predicates compare view ids, content descriptions, text and
  class names literally, plus `onScreen`, `selected` and `minHeightRatio`. No
  regex, no scripting, nothing executable.
- **Evaluation.** Detectors run by descending `priority`; a surface applies when
  every `all` predicate, at least one `any` predicate (when present) and no
  `none` predicate match. Short view ids are prefixed with the matching
  package.
- **Versioning.** `packVersion` is CalVer `YYYY.MM.DD.n`; a downloaded pack is
  accepted only when it is signed with the project's offline Ed25519 key, its
  `packVersion` is higher than the installed one and `minSchemaVersion` is
  supported. The APK always carries a bundled fallback.
- **Privacy.** UI dump fixtures (`fixtures/detectors/android/...`, Android
  work package) are sanitised before they are committed: no names, messages or
  any personal text.
