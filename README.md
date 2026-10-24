# monki-focus

An open-source, local-first toolkit against doomscrolling. It hides infinite
feeds, puts a short, honest pause in front of the sites and apps you chose to
limit, enforces a bedtime, and shows RescueTime-style focus analytics. All of
it runs on your own devices, with an optional server you can host yourself.

> **Status: pre-alpha.** Nothing is released yet. The repository is being
> bootstrapped in public; expect breaking changes everywhere.

## What it is, and what it is not

monki-focus is a **self-commitment device**: you install it, you write the
rules, and you decide who (if anyone) is your guardian. Skipping a limit is
always possible, but it is deliberate and visible, never silent.

It is **not**:

- **DRM or an unbreakable lock.** Someone with admin access to their own
  device or server can always get around it. The goal is friction and
  honesty, not impossibility.
- **Parental-control or monitoring software.** It has no hidden mode, no
  remote commands and no way for anyone else to change your rules. A guardian
  only ever sees a focus score, unlock requests and bypass events: never URLs,
  page titles or screen content. Any path to covert monitoring is treated as a
  high-severity vulnerability (see [SECURITY.md](SECURITY.md)).

## Components

| Component                | Path                       | What it does                                                                                         | Status  |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| Rules and fixtures       | `packages/rules`           | JSON Schema for rule sets, site profiles and surfaces, plus conformance fixtures every platform runs | planned |
| Decision engine          | `packages/engine`          | Pure TypeScript decision engine used by the extension and the server                                 | planned |
| Protocol                 | `packages/protocol`        | Device API (OpenAPI) and PASETO v4.public unlock-token spec and test vectors                         | planned |
| Design tokens            | `packages/design-tokens`   | Semantic light and dark tokens shared by every client                                                | planned |
| Browser extension        | `extension/`               | Chromium MV3 extension: feed hiding, intention gate, Shorts redirect, local stats                    | planned |
| Android app              | `android/`                 | Native Kotlin app built on an accessibility service: Reels/Shorts blocking, bedtime, usage stats     | planned |
| macOS app                | `macos/`                   | Native Swift menu-bar app: app usage, focus sessions, bedtime, native messaging bridge               | planned |
| Server and web dashboard | `server/api`, `server/web` | Optional, self-hostable AdonisJS server and dashboard: guardian approvals, sync, weekly report       | planned |
| End-to-end tests         | `e2e/`                     | Playwright journeys across the dashboard, the extension and the server                               | planned |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how they fit together.

## Privacy stance

- **Local first.** Every client works without a server. Analytics and rules
  live on the device until you choose to sync them.
- **Minimal by design.** The extension records domains and paths, never page
  content; page titles are off by default. The Android app never logs the text
  of what is on screen.
- **Guardian sees aggregates only.** Score, unlocks and bypasses; nothing that
  reveals what you read.
- **You own the data.** Export (ActivityWatch-compatible) and delete are
  first-class features.

Details per component: [PRIVACY.md](PRIVACY.md).

## Self-hosting

The server is optional. It will ship as a container image
(`ghcr.io/mikepineda/monki-focus-server`) plus a Docker Compose file that adds
Postgres and ntfy. A self-hosting guide arrives with the server (phase 3).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) (setup,
Conventional Commits, DCO sign-off, TDD) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as
described in [SECURITY.md](SECURITY.md).

## License

Copyright (C) monki-focus contributors.

monki-focus is free software under the
[GNU Affero General Public License v3.0 or later](LICENSE). You may run it,
study it, change it and self-host it; if you offer a modified version to others
over a network, you must publish your changes under the same license.
