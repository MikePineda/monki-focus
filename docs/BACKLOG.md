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
