# Runbook

Operational notes for maintainers and self-hosters. This is a stub; sections
are filled in as each component ships.

## Local development

- Node 24 (`nvm use`), then `npm install` (installs the git hooks).
- `npm run verify` before every pull request.

## CI & releases

### Workflows

| Workflow                 | Trigger            | Jobs                                                                                                                                                                         |
| ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                 | PR, push to `main` | `changes`, `node`, `format`, `android`, `android-instrumented`\*, `macos`, `docker`, `e2e`\*, `privacy`, `no-node-text-logging`, `ci` (aggregator). \* non-blocking          |
| `commitlint.yml`         | PR                 | `commitlint`: every PR commit (`--from base --to head`, skipped for Dependabot) plus the PR title                                                                            |
| `gitleaks.yml`           | PR, push to `main` | `gitleaks`: the PR commits with `.gitleaks.toml` from the base commit, or the full history on `main` (checksum-verified binary)                                              |
| `codeql.yml`             | PR, push, weekly   | `analyze` for `javascript-typescript`, `actions`, `java-kotlin` and `swift`; on PRs only for changed paths; Kotlin and Swift wait until `android/` and `macos/` have a build |
| `osv-scanner.yml`        | PR, push, weekly   | known vulnerabilities in every lockfile; non-blocking for now                                                                                                                |
| `release-please.yml`     | push to `main`     | `release-please`, then a `*-build` and a `*-publish` job per component (extension, android, macos, server)                                                                   |
| `.github/dependabot.yml` | weekly / monthly   | npm, gradle (`/android`), swift (`/macos/Packages/MonkiCore`), docker, github-actions; 7-day cooldown; commits `build(deps): …` and `ci(deps): …`                            |

Component jobs are path-filtered (`changes`). A change to `packages/rules` or
`packages/protocol` also runs `android` and `macos`; a change to
`.github/workflows/ci.yml` or `scripts/ci/` runs every component job. Each job
first runs `scripts/ci/component-present.sh <marker>` and becomes a passing
no-op while its component does not exist (`android/settings.gradle.kts`,
`macos/project.yml`, `Dockerfile`, `e2e/playwright.config.ts`).

Runners: `ubuntu-24.04`, `ubuntu-24.04-arm` (docker, arm64 image) and
`macos-26` (arm64, Xcode 26.x selected with `setup-xcode`, version `26`). If
`macos-26` is ever unavailable, fall back to `macos-15`, which also ships Xcode 26.

Supply-chain pins: every action by commit SHA, `postgres`, `ntfy` and the
BuildKit image by digest, gitleaks and XcodeGen
(`scripts/ci/install-xcodegen.sh`) by SHA-256. npm installs run
`scripts/ci/require-npm.sh` (npm >= 11.19.0, which enforces the root
`allowScripts` policy), then `npm ci --ignore-scripts` and
`npm rebuild --strict-allow-scripts`. Gradle wrapper validation runs before
every `./gradlew`. The `ci` aggregator also fails a pull request with more
than 3000 changed files, because the paths filter cannot see past that.

### Privacy gate

`scripts/ci/privacy-check.sh` scans every tracked or new file and every file
path. Personal patterns are never committed: the script reads them (one
case-insensitive ERE per line, `#` comments allowed) from `PRIVACY_PATTERNS`
or from the file named by `PRIVACY_PATTERNS_FILE`. Generic checks always run
too: e-mail addresses other than `@users.noreply.github.com` and
`@example.com`/`@example.org`, and phone numbers. The canonical repo and
registry URLs (and the owner handle in `.github/CODEOWNERS`) are stripped
from each line before matching; the rest of the line is still checked. Hits
print only `file:line` or a path number, never the text.

- **CI:** the `privacy` job passes the `PRIVACY_PATTERNS` repository secret.
  Without it (fork pull requests, or before the secret exists) it warns and
  runs the generic checks only. The maintainer creates or updates the secret
  from the local, gitignored pattern file:

  ```bash
  gh secret set PRIVACY_PATTERNS < docs/internal/privacy-patterns.txt
  ```

- **Locally:** lefthook's `pre-push` hook runs `scripts/ci/privacy-pre-push.sh`,
  which uses `docs/internal/privacy-patterns.txt` (from the main checkout
  when pushing from a linked worktree) and blocks the push on a hit. After
  pulling a lefthook change, run `npx lefthook install` once.
- `scripts/ci/self-test.sh` checks both guard scripts against throwaway repos
  with a synthetic pattern; CI runs it before the real check.

Run the same checks by hand before a push:

```bash
PRIVACY_PATTERNS_FILE=docs/internal/privacy-patterns.txt bash scripts/ci/privacy-check.sh
bash scripts/ci/check-android-logging.sh
gitleaks git --config .gitleaks.toml --redact .
```

### Required checks and rulesets

`ci`, `commitlint` and `gitleaks`. Only the `ci` aggregator is required for
quality: it always runs, fails when a needed job (`changes`, `node`,
`format`, `android`, `macos`, `docker`, `privacy`, `no-node-text-logging`)
failed or was cancelled and passes when the paths filter skipped it. Never
require a path-filtered job directly: a required check that does not run
blocks the PR forever. `main` accepts **rebase merges only**: every PR commit lands as written
(each one linted by `commitlint`), keeping the original commit author. Squash
merges are disabled because GitHub would rewrite the author to the merging
account's public profile name. Keep branches free of merge commits: rebase on
`main` instead of merging it.

Apply `.github/rulesets/main.json` **after** the workflows are on `main` and
each required check has run at least once, and the release-tag ruleset
(`.github/rulesets/release-tags.json`: `*-v*` tags can be created but never
moved or deleted) at the same time. Run from a clone of the repository (`gh`
fills `{owner}/{repo}` from it):

```bash
gh api --method POST -H "Accept: application/vnd.github+json" \
  repos/{owner}/{repo}/rulesets --input .github/rulesets/main.json
gh api --method POST -H "Accept: application/vnd.github+json" \
  repos/{owner}/{repo}/rulesets --input .github/rulesets/release-tags.json
```

To update one later, find its id and `PUT` the file again:

```bash
id="$(gh api repos/{owner}/{repo}/rulesets --jq '.[] | select(.name == "main") | .id')"
gh api --method PUT -H "Accept: application/vnd.github+json" \
  "repos/{owner}/{repo}/rulesets/$id" --input .github/rulesets/main.json
```

Repository settings this relies on: CodeQL **default setup off** (the
advanced `codeql.yml` replaces it), secret scanning with push protection on,
and Actions "Read repository contents" as the default token permission.

**Residual risk (single maintainer).** On a pull request, `ci.yml`,
`scripts/ci/*` (component detection, the privacy check) and
`commitlint.config.mjs` run from the PR head, so a PR could weaken the very
check that judges it; only gitleaks reads its config from the base commit.
`.github/CODEOWNERS` lists these files explicitly, but with one maintainer a
required code-owner review would block every self-merge, so it is not
enforced and these files rely on careful review. Turn on
`require_code_owner_review` in `main.json` once a second maintainer exists.

### Environments and secrets

| Environment      | Deployment branches | Reviewer                      | Used by                                             |
| ---------------- | ------------------- | ----------------------------- | --------------------------------------------------- |
| `release-please` | `main` only         | none                          | the `release-please` job (holds its token)          |
| `release`        | `main` only         | **required** (the maintainer) | every `*-publish` job: signing, attestation, upload |

"Prevent self-review" stays off for a single-maintainer repo. Release jobs run
on the push to `main`, build `$GITHUB_SHA` and fail unless the release tag
points at it (`scripts/ci/assert-release-tag.sh`).

| Secret                      | Where                | What                                                                                                              |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `PRIVACY_PATTERNS`          | repository           | The personal patterns for the privacy gate, from `docs/internal/privacy-patterns.txt`                             |
| `RELEASE_PLEASE_TOKEN`      | `release-please` env | Fine-grained PAT for this repo only: Contents, Pull requests, Issues read/write. Without it release PRs run no CI |
| `ANDROID_KEYSTORE_BASE64`   | `release` env        | `base64 -i release.keystore` of the offline upload keystore (backed up encrypted, never in the repo)              |
| `ANDROID_KEYSTORE_PASSWORD` | `release` env        | Keystore password                                                                                                 |
| `ANDROID_KEY_ALIAS`         | `release` env        | Key alias                                                                                                         |
| `ANDROID_KEY_PASSWORD`      | `release` env        | Key password                                                                                                      |
| `CWS_*`                     | `release` env, P6    | Chrome Web Store upload credentials, added with the store upload in phase 6                                       |

The Android Gradle build never sees the keystore: `assembleRelease` must
produce an **unsigned** release APK when `ANDROID_KEYSTORE_PATH` is unset
(the CI case). The publish job aligns it (`zipalign -P 16`) and signs it with
`apksigner` (v2 + v3), then verifies it. A local signed build may read
`ANDROID_KEYSTORE_PATH` and the three passwords from the environment.

### How a release happens

release-please runs in manifest mode (`release-please-config.json`,
`.release-please-manifest.json`, all components at `0.0.0` until their first
release) with one release PR per component. A component gets a release PR
only when `feat`, `fix`, `perf`, `revert`, `security`, `build` or a breaking
change touched its path; `chore`, `ci`, `docs`, `test` and `style` never cut
a release. While a component is `0.x`, `feat` bumps the minor and `fix` the
patch; a breaking change bumps the minor.

Each component then releases in two jobs. `*-build` has `contents: read`, no
secrets and no OIDC token; it builds the unsigned artefact and its SBOM and
hands them over as a workflow artifact (third-party actions only run here).
`*-publish` runs in the `release` environment with only first-party actions
(`actions/*`, `sigstore/cosign-installer`) and preinstalled CLIs: it signs,
writes `SHA256SUMS`, attests build provenance and uploads to the GitHub
Release. The server image is built per architecture as an OCI archive, pushed
by `skopeo` as `X.Y.Z-amd64` and `X.Y.Z-arm64`, joined into the `X.Y.Z`,
`X.Y` and `latest` manifest list, attested and signed with cosign keyless.

| Path                | Component   | Tag                | Version lives in                                                                         | Artefacts                                                     |
| ------------------- | ----------- | ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/rules`    | `rules`     | `rules-vX.Y.Z`     | `package.json` (+ root `package-lock.json`)                                              | none in the MVP                                               |
| `packages/engine`   | `engine`    | `engine-vX.Y.Z`    | `package.json` (+ root `package-lock.json`)                                              | none                                                          |
| `packages/protocol` | `protocol`  | `protocol-vX.Y.Z`  | `package.json` (+ root `package-lock.json`); GitHub Release is a **draft**               | none                                                          |
| `extension`         | `extension` | `extension-vX.Y.Z` | `package.json` (+ root `package-lock.json`); the build writes `manifest.json`            | zip, SPDX SBOM, `SHA256SUMS`, provenance                      |
| `server`            | `server`    | `server-vX.Y.Z`    | `server/api/package.json`, `server/web/package.json` (`$.version`)                       | GHCR image `X.Y.Z`, `X.Y`, `latest`; SBOM, provenance, cosign |
| `android`           | `android`   | `android-vX.Y.Z`   | `android/gradle.properties`: `VERSION_NAME=0.1.0 # x-release-please-version`             | signed APK, SBOM, `SHA256SUMS`, provenance                    |
| `macos`             | `macos`     | `macos-vX.Y.Z`     | `macos/Config/Version.xcconfig`: `MARKETING_VERSION = 0.1.0 // x-release-please-version` | ad-hoc signed zip and dmg, SBOM, `SHA256SUMS`, provenance     |

Notes:

- Release PRs are titled `chore(repo): release <component> X.Y.Z` and their
  commit carries a `Signed-off-by:` line (`signoff` in the config), so they
  pass `commitlint`. Squash-merge them; never edit the `CHANGELOG.md` files
  by hand.
- `packages/protocol` ships with the server and the clients, not on its own.
  Its GitHub Release is a draft with `force-tag-creation`, so the tag exists
  and release-please keeps working. `skip-github-release` is deliberately not
  used: release-please still needs a tag for every merged release PR, and
  without one it stops opening any release PR ("untagged, merged release PRs
  outstanding").
- Components that do not exist yet are safe: version files that are missing
  are skipped (release-please never creates them), the node components name
  their `package-name` explicitly so a missing `package.json` is not read for
  the tag, and a component with no releasable commits gets no PR. Each release
  job is also a no-op without its marker file.
- The server image is built from the root `Dockerfile` and `docker/`, but
  release-please only counts commits under `server/` for the server version.
  A Docker-only change that must ship needs a releasable commit that also
  touches `server/`.
- Release outputs come from `release-please-action` v5:
  `<path>--release_created`, `<path>--tag_name` and `<path>--version`, where
  `<path>` is the package key (`extension`, `android`, `macos`, `server`).

### Verifying a release

```bash
repo="$(echo https://github.com/MikePineda/monki-focus | cut -d/ -f4-5)"
gh attestation verify monki-focus-android-X.Y.Z.apk --repo "$repo"
gh attestation verify oci://ghcr.io/mikepineda/monki-focus-server:X.Y.Z --repo "$repo"
cosign verify ghcr.io/mikepineda/monki-focus-server:X.Y.Z \
  --certificate-identity-regexp '^https://github.com/MikePineda/monki-focus/\.github/workflows/release-please\.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sha256sum --check SHA256SUMS
```

## Server operations

To be written with work package S9:

- deploy and rollback;
- environment variables and secrets;
- signing-key rotation (`unlock-signing`, `policy-signing`);
- ntfy configuration and topic rotation;
- backups and restore drill;
- health checks and monitoring.

## Incident response

To be written: compromised signing key (rotate, force re-pairing), leaked
device token (revoke), compromised release credentials.
