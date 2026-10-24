# Contributing to monki-focus

Thanks for helping. This guide covers setup, the rules every change follows
and how to get a pull request merged. Agents working in the repo also read
[CLAUDE.md](CLAUDE.md).

## Ground rules

- **Nothing personal in the repo.** No real names, emails, locations, phone
  numbers, browsing history or screenshots with private content: not in code,
  docs, fixtures, examples, test data or commit messages. Use roles ("the
  user", "the guardian", "the maintainer") and synthetic data with the real
  structure. Android UI dumps used as fixtures go through
  `packages/rules/scripts/sanitize-uidump.mjs` first.
- **Tests first.** Write the failing test, then the code. Test names read like
  specs (`hide_feed_never_blocks_a_permalink`). Every business rule is born
  with its test, and shared behaviour lives in fixtures that every platform
  runs.
- **One concept per file**, named after the concept (`EscalationStore.ts`,
  `DecisionEngine.kt`). No `utils`, `helpers` or `misc` files.
- **Pure domain code.** Decision, analytics and token logic take the clock and
  other inputs as parameters: no I/O, no implicit "now".
- **English** for code, comments, docs and commit messages. User-facing copy
  only through the i18n catalogs (`en` and `es`), with a parity test.
- **Additive database migrations.** Add columns and tables; drop or rename
  only in a later release.

## Setup

Common to all components:

```bash
nvm use            # Node 24 (.nvmrc)
npm install        # installs dependencies and the git hooks (lefthook)
npm run verify     # the gate every pull request must pass
```

Per component (each arrives with its work package; commands may change):

| Component                  | Toolchain                        | Main commands                                                             |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `packages/*`               | Node 24                          | `npm test -w packages/<name>`                                             |
| `extension/`               | Node 24, Chromium or Brave       | `npm run dev -w extension`, `npm test -w extension`                       |
| `android/`                 | JDK 21, Android SDK              | `cd android && ./gradlew spotlessCheck testDebugUnitTest assembleDebug`   |
| `macos/`                   | Xcode 26, XcodeGen               | `swift test --package-path macos/Packages/MonkiCore`, `xcodegen generate` |
| `server/api`, `server/web` | Node 24, Docker (Postgres, ntfy) | `docker compose up -d`, `npm run dev`, `npm test -w server/api`           |
| `e2e/`                     | Node 24, Docker, Playwright      | `npm run e2e`                                                             |

`npm run verify:quick` skips the slow layers; `npm run verify:all` runs every
component even if it did not change.

## Commits

### Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
and are linted locally (lefthook `commit-msg`) and in CI. release-please uses
them to version each component and write its changelog, so the type matters:
`feat` bumps the minor version, `fix` the patch version, and `!` or
`BREAKING CHANGE:` the major version. `security` is an extra type for security
fixes.

Allowed scopes: `rules`, `engine`, `protocol`, `design-tokens`, `extension`,
`android`, `macos`, `server`, `web`, `e2e`, `ci`, `deps`, `docs`, `repo`,
`security`.

```text
feat(extension): hide the Reddit home feed

fix(android): keep the bedtime overlay above the launcher
```

### Developer Certificate of Origin

Every commit must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org): by adding
the trailer you certify that you wrote the change or have the right to submit
it under the project's license.

```bash
git commit -s -m "fix(rules): ..."
# with an extra trailer, keep Signed-off-by first:
git commit -s -m "fix(rules): ..." --trailer "Co-Authored-By: Name <address>"
```

The `prepare-commit-msg` hook adds a sign-off from your git identity if you
forget, and commitlint rejects messages without one. Use the identity you want
public; a GitHub `noreply` address is fine.

## License headers

New source files start with an SPDX header:

```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
```

Use the comment syntax of the language (`//` for TypeScript, Kotlin and Swift,
`#` for shell and YAML, `<!-- -->` for HTML). Copyright belongs to
"monki-focus contributors"; do not add personal copyright lines. Code vendored
from another project keeps its original license header and gets an entry in a
`NOTICE` file.

## Pull requests

- Keep each pull request to one concern; link the issue or ADR.
- Fill in the template checklist. `npm run verify` must be green.
- Changes to unlock tokens or crypto, pairing or guardianship, server routes,
  rules or policy signing, Android accessibility or anti-bypass, native
  messaging, the LLM or digest, or CI workflows need a security review (see
  [docs/threat-model.md](docs/threat-model.md)).
- Significant design decisions get an ADR in `docs/adr/`.

## Reporting problems

Bugs and ideas go to GitHub issues. Vulnerabilities go to
[private vulnerability reporting](https://github.com/MikePineda/monki-focus/security/advisories/new),
never a public issue; see [SECURITY.md](SECURITY.md).
