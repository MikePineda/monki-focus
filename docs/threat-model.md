# Threat model

monki-focus is a self-commitment device. The person most likely to attack it
is its own user, in a weak moment. The design goal is therefore not to make
bypassing impossible (an admin of their own device always wins) but to make
every bypass **deliberate and visible**, while making sure the tool can never
be turned into stalkerware against that same user.

Legend: **M** mitigated · **D** detected and reported to the guardian ·
**R** accepted residual risk, documented. **P1** before the first release,
**P2** after it.

## 1. Trust boundaries and assets

| Boundary                                                  | Untrusted side                                     | Assets                                                                   |
| --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| B1 User (weak moment) ↔ enforcement                       | device owner: admin/root, clock, settings, storage | integrity of policy and rules, tokens, bypass events                     |
| B2 Web pages ↔ extension                                  | DOM of the target sites                            | service worker, interstitial, token store                                |
| B3 Other extensions and processes ↔ native host ↔ Mac app | same OS user                                       | app commands, window titles, trusted time                                |
| B4 On-screen content ↔ Android accessibility service      | everything visible (chats, banking)                | privacy of the user and third parties                                    |
| B5 Clients ↔ server                                       | network, token theft                               | heartbeats, sync, unlocks                                                |
| B6 User ↔ guardian ↔ other tenants                        | another account on the instance                    | aggregated data, approve/deny, isolation                                 |
| B7 ntfy ↔ server                                          | whoever reads the topic or notification            | the unlock decision                                                      |
| B8 Digest sources and LLM ↔ dashboard                     | hostile text → model → HTML                        | session, truthfulness of the report                                      |
| B9 Repo, CI, signatures, rules feed ↔ binaries            | supply chain                                       | APK keystore, extension store account, Homebrew tap, `rules-signing` key |
| B10 Whoever holds the phone ↔ its owner                   | coercive installer                                 | consent and autonomy (stalkerware)                                       |

Separate keys: `unlock-signing` and `policy-signing` on the server (secrets,
never stored in clear in the database or written to logs); `rules-signing`
kept offline by the maintainer; the APK keystore kept offline.

## 2. Threats and decided mitigations

| Threat                                                | Mitigation                                                                                                                                                                                                                                                                                                                     | Status                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Clock or time-zone change                             | `trusted_now = max(wall, last_server_time + monotonic_elapsed)` (`elapsedRealtime` / `mach_continuous_time`); time zone fixed in the signed policy, changing it counts as loosening (applies tomorrow); time-change broadcasts and automatic time turned off become events                                                     | M+D P1                   |
| Replay of an old token                                | local `jti` store; token bound to the device (implicit assertion); short `exp`; monotonic anchor; reboot invalidates active tokens (boot count)                                                                                                                                                                                | M P1                     |
| Forged token                                          | PASETO v4.public with Ed25519, public keys pinned at pairing, no algorithm negotiation                                                                                                                                                                                                                                         | M P1                     |
| User administers the server or ntfy and self-approves | P1: documented; key held as a secret; copy of events to the guardian's ntfy. P2: approval co-signed with the guardian's passkey, verified offline                                                                                                                                                                              | R→M P2                   |
| Editing local storage or database                     | policy signed by the server; if it does not verify, the last valid one applies; heartbeat reports `policy_hash`, a mismatch is an event; local-only mode is R                                                                                                                                                                  | D P1                     |
| Android: turning accessibility off                    | bounce from the relevant settings screens with a visible "Turn off (waits 2 min, notifies the guardian)" button; unbind/interrupt callbacks produce an event; `a11y_enabled` in the heartbeat                                                                                                                                  | D P1                     |
| Android: uninstall, force stop, clear data            | Device Admin as friction only; bounce from the app's own info screen and the package installer; reinstall = new device id → re-pairing → notice; dead-man switch                                                                                                                                                               | D P1                     |
| Android: safe mode, factory reset, adb                | not preventable; the heartbeat gap fires the dead-man switch; developer options and USB debugging feed `risk_state`                                                                                                                                                                                                            | D/R P1                   |
| Android: another browser or a PWA                     | package name from window-state events; unsupported browsers (anything resolving `ACTION_VIEW http`) are blocked or counted according to the rules                                                                                                                                                                              | M partial P1             |
| Extension: incognito, another browser, removing it    | the Mac app sees the frontmost bundle id: an unsupported browser is closed or counted; extension pings the host every 60 s, "browser without ping" is an event; optional configuration profile forcing the extension and disabling incognito                                                                                   | D (M with profile) P1/P2 |
| Killing the Mac app or revoking Accessibility         | LaunchAgent with `KeepAlive`; mutual watchdog extension ↔ app ↔ server; `AXIsProcessTrusted() == false` is an event                                                                                                                                                                                                            | D P1                     |
| Second, unregistered device                           | out of scope; the guardian sees the count and names of devices                                                                                                                                                                                                                                                                 | R                        |
| Abuse of the emergency override                       | 2-minute local wait; always notifies (offline queue); counter visible to the guardian; local hash chain of events                                                                                                                                                                                                              | D P1                     |
| Pairing brute force                                   | code generated by the monitored person; 10-minute TTL; one active code; invalidated after 5 attempts; rate limit per IP and account; HMAC with pepper, constant-time comparison; **mandatory confirmation on the monitored device** showing the guardian's account                                                             | M P1                     |
| Guardian takeover or swap                             | only the monitored person changes it, with re-authentication; notice to the outgoing guardian; 2FA (TOTP or passkey) for guardians                                                                                                                                                                                             | M P1                     |
| Forging or replaying approve/deny (ntfy)              | `auth-default-access: deny-all`, ACL and token per guardian, random 128-bit topic; `http` POST action with a 256-bit single-use capability, hashed, bound to `(request_id, guardian_id, decision)`, TTL ≤ 15 min; atomic consumption invalidates both; never a mutating GET; short ntfy cache                                  | M P1                     |
| Device token theft                                    | 256-bit token hashed in the database, per-device abilities; Keystore/Keychain; the extension stores no token when the Mac app is present; revocable; 30-day rotation                                                                                                                                                           | M P1                     |
| IDOR                                                  | every query goes through the authenticated user's relations; guardians only through an active guardianship; 404, not 403; allowlisted guardian DTO                                                                                                                                                                             | M P1                     |
| CSRF / XSS on the dashboard                           | CSRF protection; `__Host-` cookie, HttpOnly, Secure, SameSite=Lax; CSP with nonce, `img-src 'self'`; never render data as raw HTML                                                                                                                                                                                             | M P1                     |
| Prompt injection: digest source → LLM → dashboard     | LLM without tools or other users' data; JSON output validated and rendered as text; links rebuilt from post ids; the score is deterministic, never from the LLM                                                                                                                                                                | M P1                     |
| SSRF and LLM cost                                     | fixed source hosts only; strict source-name validation; no redirects; timeouts; per-user weekly budget                                                                                                                                                                                                                         | M P1                     |
| Native host abuse                                     | exact `allowed_origins` (stable id); no `externally_connectable`; the app validates the peer (helper code requirement) and `getpeereid` on a 0600 socket; minimal API `status`, `ping`, `trusted_time`, `signed_policy`, `report_event`; no unlock without a token; never returns titles; messages ≤ 1 MB with a strict schema | M P1                     |
| Remote rules update as an injection channel           | pure data signed offline, monotonic version, the server only re-serves the blob                                                                                                                                                                                                                                                | M P1                     |
| Exposure of accessibility data                        | restricted `packageNames`; read the tree only for target apps; never log node text; URL reduced to host plus first segment in memory; no text persisted                                                                                                                                                                        | M P1                     |
| Stalkerware / coercive control                        | see the reconciliation below                                                                                                                                                                                                                                                                                                   | M P1                     |
| Unsigned macOS binaries or tap                        | cask with pinned `sha256`; `gh attestation verify` documented; never recommend a global quarantine removal; Developer ID and notarization in P2                                                                                                                                                                                | R→M P2                   |
| APK keystore, extension store account, CI             | see the CI and release requirements below                                                                                                                                                                                                                                                                                      | M P1                     |
| Analytics at rest                                     | Android file-based encryption and sandbox, backups disabled with explicit data-extraction rules; Mac files 0600; server retention limits plus export and deletion; opt-in titles encrypted per column in P2                                                                                                                    | M/R P1                   |
| Analytics in transit                                  | TLS only; no cleartext; HSTS; unlock integrity does not depend on TLS                                                                                                                                                                                                                                                          | M P1                     |

### Reconciling anti-bypass with anti-stalkerware

Bypassing is deliberate and visible, never impossible. These are P1
requirements on every client:

1. The monitored person installs the app, generates the pairing code and
   accepts the guardian on their own device.
2. A persistent notification states that monki-focus is active and what the
   guardian sees (score, unlocks, bypasses); it is re-posted if dismissed.
3. The launcher icon is always visible; any hidden mode is forbidden in code.
4. The rules belong to the monitored person; the guardian cannot change rules
   or send remote commands.
5. Leaving is easy: "Leave and unpair" from the app and from every bounce
   screen; a 2-minute wait, then Device Admin and the bounce are disarmed and
   the guardian gets a neutral message ("pairing ended").
6. Re-consent on the device every 30 days; without it the guardian's access
   lapses.
7. A "What your guardian sees" screen with a real example of the guardian DTO.

## 3. Unlock token

- **PASETO v4.public** (Ed25519, no `alg` header, versioned footer and
  implicit assertion). A small purpose-built verifier (PAE plus the platform's
  Ed25519: WebCrypto, `node:crypto`, Tink, CryptoKit) on all four platforms,
  tested against the official PASETO vectors. See
  [ADR 0002](adr/0002-paseto-v4-unlock-tokens.md).
- **Claims:** `v: 1`, `typ: "unlock"`, `iss` (canonical instance URL), `sub`,
  `dev`, `rule`, `scope` (exact domain, path or package; no global wildcard),
  `dur_s`, `iat` / `nbf` / `exp` (server time; `exp - iat` ≤ 4 h), `jti`
  (128 bits), `req`, `pol`. Footer `{"kid": "…"}`. Implicit assertion
  `"monki-focus/unlock/v1|" + iss + "|" + dev`. Policy tokens use a different
  `typ` and a different key.
- **Keys:** public keys pinned at pairing (trust on first use over TLS, with
  the fingerprint shown on both sides). Rotation: a new `kid` signed by the
  old one; clients accept at most two kids. A compromised key means
  re-pairing.
- **Clock:** on receipt the client stores
  `(jti, server_iat, mono_at_receipt, boot_count)`. The token is valid only if
  the boot count matches, `mono_now - mono_at_receipt ≤ (exp - iat) + 60 s`, and
  `trusted_now ∈ [nbf - 60 s, exp + 60 s]`. After a reboot it must be
  revalidated online; offline it fails closed. macOS uses
  `mach_continuous_time` plus the boot session UUID. The extension gets
  trusted time from the Mac app; without it, `Date.now()` plus
  `performance.now()` (R).
- **Replay and revocation:** `jti` stored locally (Room, SQLite,
  `storage.local`); activation is idempotent within the window; a deactivated
  or expired `jti` never reactivates; purge at `exp + 1 day`; short `exp` plus
  a `revoked_jti` list in every heartbeat; offline means no revocation (R).

## 4. Changes that need a security review

Unlock tokens and crypto · pairing, capabilities and guardianship · server
routes (every pull request that touches them) · rules and policy signing ·
Android accessibility and anti-bypass · native messaging and the bridge ·
LLM and digest · CI workflows.

Review checklists, by area:

- **Tokens:** official vectors pass; claims never parsed before the signature
  verifies; constant-time comparisons; monotonic anchoring; failures close.
- **Pairing and guardianship:** TTL and attempt limits; atomic consumption
  (`SELECT … FOR UPDATE`); hashes at rest; confirmation on the monitored
  device; allowlisted guardian DTO.
- **Server routes:** scoped queries returning 404; device abilities; CSRF;
  rate limits; no secrets in logs.
- **Rules and policy:** signature verified before parsing; anti-rollback;
  size limits.
- **Android:** `packageNames`; no node text in logs; persistent notification
  and exit flow; no exported components beyond the Device Admin receiver.
- **Native messaging:** `allowed_origins`; peer validation; size limits;
  minimal API.
- **LLM:** no tools; output rendered as text; CSP; source allowlist.
- **CI:** actions pinned by SHA; `permissions: {}` by default; no
  `pull_request_target` with a PR checkout; release environments with a
  reviewer; build attestations.
