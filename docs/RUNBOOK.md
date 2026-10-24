# Runbook

Operational notes for maintainers and self-hosters. This is a stub; sections
are filled in as each component ships.

## Local development

- Node 24 (`nvm use`), then `npm install` (installs the git hooks).
- `npm run verify` before every pull request.

## CI & releases

### Workflows

| Workflow                 | Trigger                   | Jobs                                                                                                                                                                         |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                 | PR, push to `main`        | `changes`, `node`, `format`, `android`, `android-instrumented`\*, `macos`, `docker`, `e2e`\*, `privacy`, `no-node-text-logging`, `ci` (aggregator). \* non-blocking          |
| `commitlint.yml`         | PR                        | `commitlint`: every PR commit (`--from base --to head`) plus the PR title                                                                                                    |
| `gitleaks.yml`           | PR, push to `main`        | `gitleaks`: the PR commits, or the full history on `main` (checksum-verified binary, `.gitleaks.toml`)                                                                       |
| `codeql.yml`             | PR, push, weekly          | `analyze` for `javascript-typescript`, `actions`, `java-kotlin` and `swift`; on PRs only for changed paths; Kotlin and Swift wait until `android/` and `macos/` have a build |
| `osv-scanner.yml`        | PR, push, weekly          | known vulnerabilities in every lockfile; non-blocking for now                                                                                                                |
| `release-please.yml`     | push to `main`            | `release-please`, then `release-extension`, `release-android`, `release-macos`, `release-server-build`, `release-server-publish`                                             |
| `.github/dependabot.yml` | weekly (actions: monthly) | npm, gradle (`/android`), swift (`/macos/Packages/MonkiCore`), docker, github-actions; commits `build(deps): …` and `ci(deps): …`                                            |

Component jobs are path-filtered (`changes`). A change to `packages/rules` or
`packages/protocol` also runs `android` and `macos`; a change to
`.github/workflows/ci.yml` or `scripts/ci/` runs every component job. Each job
first runs `scripts/ci/component-present.sh <marker>` and becomes a passing
no-op while its component does not exist (`android/settings.gradle.kts`,
`macos/project.yml`, `Dockerfile`, `e2e/playwright.config.ts`).

Runners: `ubuntu-24.04`, `ubuntu-24.04-arm` (docker, arm64 image) and
`macos-26` (arm64, Xcode 26.x selected with `setup-xcode`, version `26`). If
`macos-26` is ever unavailable, fall back to `macos-15`, which also ships Xcode 26.

Run the same privacy and logging checks locally before every push:

```bash
bash scripts/ci/privacy-check.sh        # prints file:line only, never the match
bash scripts/ci/check-android-logging.sh
gitleaks git --config .gitleaks.toml --redact .
```

### Required checks

`ci`, `commitlint` and `gitleaks`. Only the `ci` aggregator is required for
quality: it always runs, fails when a needed job (`changes`, `node`,
`format`, `android`, `macos`, `docker`, `privacy`, `no-node-text-logging`)
failed or was cancelled and passes when the paths filter skipped it. Never
require a path-filtered job directly: a required check that does not run
blocks the PR forever.

Apply `.github/rulesets/main.json` **after** the workflows are on `main` and
each required check has run at least once, from a clone of the repository
(`gh` fills `{owner}/{repo}` from it):

```bash
gh api --method POST -H "Accept: application/vnd.github+json" \
  repos/{owner}/{repo}/rulesets --input .github/rulesets/main.json
```

To update it later, find its id and `PUT` the file again:

```bash
id="$(gh api repos/{owner}/{repo}/rulesets --jq '.[] | select(.name == "main") | .id')"
gh api --method PUT -H "Accept: application/vnd.github+json" \
  "repos/{owner}/{repo}/rulesets/$id" --input .github/rulesets/main.json
```

Repository settings this relies on: CodeQL **default setup off** (the
advanced `codeql.yml` replaces it), secret scanning with push protection on,
and Actions "Read repository contents" as the default token permission.

### Secrets and the `release` environment

Create an environment named `release` (Settings > Environments) with a
**required reviewer** (the maintainer), "Prevent self-review" off for a
single-maintainer repo, and a deployment branch rule that allows only `main`
(release jobs run on the push to `main` and check out the new tag). Every
release job uses it, so each release waits for an approval.

| Secret                      | Where             | What                                                                                                                 |
| --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `RELEASE_PLEASE_TOKEN`      | repository        | Fine-grained PAT for this repo only: Contents, Pull requests and Issues read/write. Without it release PRs run no CI |
| `ANDROID_KEYSTORE_BASE64`   | `release` env     | `base64 -i release.keystore` of the offline upload keystore (backed up encrypted, never in the repo)                 |
| `ANDROID_KEYSTORE_PASSWORD` | `release` env     | Keystore password                                                                                                    |
| `ANDROID_KEY_ALIAS`         | `release` env     | Key alias                                                                                                            |
| `ANDROID_KEY_PASSWORD`      | `release` env     | Key password                                                                                                         |
| `CWS_*`                     | `release` env, P6 | Chrome Web Store upload credentials, added with the store upload in phase 6                                          |

The Android `release` signingConfig reads `ANDROID_KEYSTORE_PATH` (set by the
workflow to a file in `$RUNNER_TEMP`, deleted at the end of the job) and the
three secrets above from the environment.

### How a release happens

release-please runs in manifest mode (`release-please-config.json`,
`.release-please-manifest.json`, all components at `0.0.0` until their first
release) with one release PR per component. A component gets a release PR
only when `feat`, `fix`, `perf`, `revert`, `security`, `build` or a breaking
change touched its path; `chore`, `ci`, `docs`, `test` and `style` never cut
a release. While a component is `0.x`, `feat` bumps the minor and `fix` the
patch; a breaking change bumps the minor.

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
  pass `commitlint`. Merge them with squash or merge, never edit the
  `CHANGELOG.md` files by hand.
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
