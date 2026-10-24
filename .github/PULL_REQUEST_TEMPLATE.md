## What and why

<!-- One or two sentences. Link the issue or ADR if there is one. -->

## Components touched

<!-- rules / engine / protocol / design-tokens / extension / android / macos / server / web / e2e / ci / docs -->

## Checklist

- [ ] `npm run verify` is green locally (or `verify:all` when shared packages changed).
- [ ] Tests came first and their names read like specs; every new rule has its test.
- [ ] Shared fixtures (`packages/rules`, `packages/protocol`) still pass on every platform that consumes them.
- [ ] User-facing copy goes through the i18n catalogs (`en` and `es`), and the parity test passes.
- [ ] Database migrations are additive (no drops or renames in the same release).
- [ ] No personal data: no real names, emails, locations, URLs from browsing history or screenshots with private content.
- [ ] Commits follow Conventional Commits and are signed off (`git commit -s`).
- [ ] Docs updated (`docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, an ADR or `PRIVACY.md`) when behaviour or data handling changed.

## Security review

Required when the change touches any of: unlock tokens or crypto, pairing or guardianship, server routes, rules or policy signing, Android accessibility or anti-bypass, native messaging or XPC, the LLM or digest, or CI workflows.

- [ ] Not needed: none of the above is touched.
- [ ] Needed: requested, and the relevant checklist from `docs/threat-model.md` is addressed below.

<!-- Security notes (threats considered, tests added): -->
