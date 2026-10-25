# Backlog

Ideas that are out of the current scope. One dated line each; newest last.

- 2026-10-25 X/Twitter as a digest source (the official API is paid; revisit if a free path appears).
- 2026-10-25 Firefox support for the extension (MV3 differences in declarative rules and native messaging).
- 2026-10-25 iOS client (Screen Time / Family Controls APIs; needs a different enforcement model).
- 2026-10-25 Windows client (frontmost-app watcher and native messaging host).
- 2026-10-25 Guardian approvals co-signed with the guardian's passkey, verified offline, so a server admin cannot self-approve.
- 2026-10-25 Apple Developer ID signing and notarization for the macOS app (removes the "Open anyway" step).
- 2026-10-25 detekt for the Android tree once a stable 2.x supports Kotlin 2.4 (Spotless + ktlint + Android Lint until then).
- 2026-10-25 Rules: on a validation failure engines keep the last valid rule set, never an empty one (an alias-pack update could turn a valid set into duplicates).
- 2026-10-25 Rules: reject `;` inside glob literals for clarity (such a glob can never match a known path).
- 2026-10-25 Rules: replace the built-in public-suffix heuristic with the Public Suffix List (today `ne.jp`, `me.uk`, `gob.mx` pass).
- 2026-10-25 Rules: Kotlin and Swift runners must generate the over-256-KiB `invalid` case themselves; add it to the runner checklist.
- 2026-10-25 Android/web: a browser detector pack that reads the page surface, so Shorts on domain-only URL bars is blocked instead of gated.
- 2026-10-25 Protocol: raise the trusted-time floor from `iat` only after a successful receive (a refused future-`iat` token can push time ahead until the next heartbeat).
- 2026-10-25 Docs: update `docs/threat-model.md` §3 and `docs/CONTRACTS.md` to the final token spec (signed time token, ratcheting floor, revocations in the time token).
- 2026-10-25 Protocol: list vendored vector files in `.prettierignore` so they stay byte-identical to upstream.
- 2026-10-25 Self-hosting docs: release issuers are `https://host` only (no port, no IP literal); LAN setups need a hostname and a reverse proxy on 443.
- 2026-10-25 macOS release: `release-please.yml` re-signs with `codesign --force --deep --sign -`, which drops the hardened-runtime flag the Release build sets; add `--options runtime` (and sign the helper before the app instead of `--deep`).
- 2026-10-25 macOS: stable self-signed signing certificate (plan M1) so Accessibility survives rebuilds; M1 ships ad-hoc only.
- 2026-10-25 Android: `HeartbeatWorker` (plan §2.9: heartbeat rows, `BypassDetector`, dead-man POST to the server) once server pairing exists; WP 2.8/2.9 shipped only the local workers.
- 2026-10-25 Android: real `DetectorPackUpdateWorker` download once a server and a pinned `rules-signing` key exist (today it only re-verifies stored packs).
- 2026-10-25 Android: a user-chosen device name for the ActivityWatch buckets (today the neutral `phone`), and an ActivityWatch/CSV export of the local data on the stats screen like the extension's.
- 2026-10-25 Android: detect private (incognito) tabs in Chrome and Brave from device-validated view ids (data-only predicate in the browser pack, marked unverified until captured) and skip `siteSeen` on them; today their domains are counted locally.
- 2026-10-25 Android: a Settings toggle "Record websites" (default on) so the user can turn web-domain statistics off entirely (no `web.tab.current` heartbeats at all).
- 2026-10-25 macOS: measure whether App Nap delays the 5-second AFK poll of the menu-bar app; if so hold a `ProcessInfo.beginActivity` (only AFK latency suffers, event continuity does not depend on timers).
- 2026-10-25 macOS: a missed unlock or wake notification keeps the user forced AFK until the next one; cross-check with `CGSessionCopyCurrentDictionary` on each AFK poll.
- 2026-10-25 macOS: M4's "one real hour without gaps or overlaps" check is manual today; add a debug query or export that reports gaps and overlaps per bucket.
- 2026-10-25 Server: re-consent every 30 days (threat model §2, item 6) is not enforced server-side yet; the guardianship check could require a recent device-side confirmation.
- 2026-10-25 Server: `GET /device/me` should report the guardian state (pending/active/revoking with the deadline) so clients can show "What your guardian sees" and the leave countdown.
- 2026-10-25 Server: a cap on live guardian links per ward (the schema allows several; the MVP UI shows one).
- 2026-10-25 Server: QR pairing with a 128-bit secret in the URL fragment next to the code, so a scanned QR skips the 6-digit guess space (the typed code stays for manual entry).
- 2026-10-25 Server (S6): the ntfy publisher must claim outbox rows `FOR UPDATE SKIP LOCKED` (and re-read the topic) so a topic rotation never races an in-flight send to the old topic.
- 2026-10-25 Server (S6): the `BypassAlerts` implementation must skip `guardian_*` kinds; their guardian notices are already queued by the link flows.
- 2026-10-25 Bridge: verify the app's peer is the bundled `monki-bridge` (LOCAL_PEERPID + code signature) once a stable signing identity exists; M5 checks the uid only.
- 2026-10-25 Bridge: send the extension's emergency overrides as `bypass.event` (map the local outbox payload to the device API shape) and wire `rules.snapshot`, `unlock.token` (verified) and `focusSession.state` in the worker (M6/M7).
- 2026-10-25 Bridge: list the Chrome Web Store extension id in `NativeHostManifest` once the store listing exists, and add the onboarding "Install connector" step (M8).
