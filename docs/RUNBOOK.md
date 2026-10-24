# Runbook

Operational notes for maintainers and self-hosters. This is a stub; sections
are filled in as each component ships.

## Local development

- Node 24 (`nvm use`), then `npm install` (installs the git hooks).
- `npm run verify` before every pull request.

## Releases

To be written with work package 0.6 (release-please per component: tags
`rules-vX.Y.Z`, `extension-vX.Y.Z`, `android-vX.Y.Z`, `macos-vX.Y.Z`,
`server-vX.Y.Z`).

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
