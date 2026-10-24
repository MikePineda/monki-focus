# Contracts

The platforms share data contracts, not code. Each contract has one source of
truth in the repo and a conformance suite that every consumer runs. A change to
a contract is a change to its fixtures first.

| Contract                        | Source of truth (planned)                                                                   | Work package | Status  |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------ | ------- |
| Rule set schema v1              | `packages/rules/schema/v1/*.schema.json`                                                    | 0.2          | planned |
| Surfaces and site profiles      | `packages/rules/data/surfaces.json`, `data/sites/*.json`                                    | 0.2          | planned |
| Decision fixtures               | `packages/rules/fixtures/` (`given/when/then`, one `id` per spec)                           | 0.2          | planned |
| Analytics fixtures              | `packages/rules/fixtures/analytics/*.json`                                                  | 0.2, E3      | planned |
| Unlock token (PASETO v4.public) | `packages/protocol` schemas and `fixtures/unlock-tokens/`, `docs/protocol/unlock-tokens.md` | 0.3          | planned |
| Signed policy token             | `packages/protocol` (separate `typ` and key)                                                | 0.3, S3      | planned |
| Device API                      | `packages/protocol/openapi.yaml` (`/api/v1`, `X-Client-Version`)                            | 0.3          | planned |
| Native messaging bridge         | `macos` bridge contract (length-prefixed JSON, five methods)                                | M5           | planned |
| Rules feed signature            | detached Ed25519 signature, offline `rules-signing` key                                     | 0.2          | planned |

## Rules

To be written by work package 0.2: the `Ruleset`, `Rule`, `Target`,
`Schedule`, `Bedtime` and `CategoryAssignment` shapes; the two decision axes
(`access`, `content`); specificity order; overlays; fixture envelope format.

## Decision fixtures

To be written by work package 0.2: the fixture envelope, the `kind`s
(`decision`, `specificity`, `url-normalize`, `schedule`, `escalation`,
`rule-change`, `activity`, `unlock-token`) and how each platform loads them.

## Unlock token

To be written by work package 0.3: PASETO v4.public claims, footer, implicit
assertion, clock and replay rules, key pinning and rotation. See
[ADR 0002](adr/0002-paseto-v4-unlock-tokens.md) and
[threat-model.md](threat-model.md).

## Device API

To be written by work package 0.3: enrolment, heartbeat, activity blocks,
bypass events, unlock requests and long-poll, keys, versioning (`426` for
outdated clients).

## Native messaging

To be written by work package M5: message framing, size limit, the
`status`, `ping`, `trusted_time`, `signed_policy` and `report_event` methods,
`allowed_origins`, peer validation.
