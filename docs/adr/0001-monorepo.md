# ADR 0001: One polyglot monorepo

- Status: accepted
- Date: 2026-10-25

## Context

monki-focus has four platforms (Chromium extension, Android, macOS, an
optional server with a dashboard) written in three languages (TypeScript,
Kotlin, Swift). They must agree exactly on the rule-set schema, the decision
semantics, the analytics model and the unlock-token format. Drift between
platforms would show up as a rule that blocks on the phone but not in the
browser, or a token that verifies on one client and not another.

## Decision

Keep everything in one repository:

- npm workspaces plus Turborepo for the TypeScript parts (`packages/*`,
  `extension`, `server/api`, `server/web`, `e2e`);
- Gradle for `android/` and XcodeGen plus Swift packages for `macos/`, which
  are not npm workspaces and read shared fixtures by relative path;
- shared **contracts and fixtures**, not shared code: `packages/rules` and
  `packages/protocol` are the source of truth and every platform runs their
  conformance suites;
- one `npm run verify` gate that detects which components changed and runs
  their layers (WP 0.7);
- release-please in manifest mode with one component per platform and tags
  such as `extension-v0.3.0`.

## Consequences

- A contract change and every platform's adaptation land in one pull request,
  and CI proves conformance on all of them.
- CI needs path filters so a docs change does not build Android and macOS.
- Contributors may need several toolchains; the verify script reports a
  missing toolchain clearly instead of silently skipping a changed component.
- Versioning is per component, so platforms release independently.
