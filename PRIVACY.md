# Privacy

monki-focus is local-first. Every client works on its own, without an account
or a server, and keeps its data on the device. A server is optional, and when
you use one it is either yours or one run by someone you chose. The
maintainers do not run a hosted service and receive no data from you.

> **Status: pre-alpha.** This document describes the design that the code
> must follow. It will be kept in sync with each release; a change to data
> handling ships with a change to this file.

## Principles

- **Collect the minimum** needed to apply your rules and show your own stats.
- **Domains, not pages.** Web activity is recorded as domain and path; page
  titles are off by default; page content is never read for analytics.
- **Nothing on screen is stored.** The Android accessibility service reads
  only the target apps, keeps what it needs in memory and never logs or
  persists on-screen text.
- **Aggregates for the guardian.** A guardian never sees URLs, page titles,
  app content or screen text.
- **No ads, no third-party analytics, no tracking SDKs.**
- **Export and delete** are always available.

## What each component collects

### Browser extension

| Data                                                                                           | Where it lives                  | Leaves the device?                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| Your rules and settings                                                                        | `chrome.storage.local`          | Only if you enable sync to your server                 |
| Activity events: domain, path (no query or fragment), whether the tab played audio, timestamps | IndexedDB                       | No (raw events stay local)                             |
| Page titles                                                                                    | Not collected unless you opt in | No                                                     |
| 5-minute activity blocks (category level, seconds, optionally the domain)                      | IndexedDB                       | Only if you enable sync to your server                 |
| Intentions you type at the gate, unlock and bypass events                                      | IndexedDB                       | Bypass and unlock events go to your server when paired |

Raw events are kept for 30 days; you can delete everything from the options page.

### Android app

| Data                                                                      | Where it lives         | Leaves the device?                         |
| ------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| Rules and settings                                                        | App storage            | Only if you enable sync                    |
| App usage from Android's usage statistics (package name, time)            | App database           | Aggregated blocks, only if you enable sync |
| Browser address bar: host and first path segment, in memory only          | Not persisted          | No                                         |
| On-screen text and accessibility tree                                     | Never stored or logged | No                                         |
| Bypass events (accessibility disabled, clock changed, emergency override) | App database           | Yes, to your server when paired            |

The app disables Android cloud backup of its data.

### macOS app

| Data                         | Where it lives                                    | Leaves the device?                         |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Rules and settings           | Local database (file mode 0600)                   | Only if you enable sync                    |
| Frontmost app and idle state | Local database                                    | Aggregated blocks, only if you enable sync |
| Window titles                | Kept in memory; stored only if you opt in         | No                                         |
| Browser activity             | Received from the extension over the local bridge | No (the bridge never returns titles)       |

### Server (optional, self-hosted)

| Data                                                                         | Purpose                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| Account: email, password hash, time zone, language                           | Sign-in and computing days in your time zone |
| Devices: name, platform, client version, last heartbeat                      | Device list, dead-man alerts                 |
| Heartbeats: protection state, policy hash, clock and risk signals            | Detecting disabled protection                |
| 5-minute activity blocks: category level, seconds, optional domain or app id | Your dashboard and weekly report             |
| Unlock requests and decisions, bypass events                                 | Guardian approvals and the audit trail       |

The server never receives URLs beyond the domain, page titles or screen text.

## What a guardian sees

A guardian is someone you invite, from your own device, to hold the key for
unlock requests. They see only:

- your **focus score** (per day and week) and time per category level;
- your **unlock requests** and their decisions;
- **bypass events** (for example "protection disabled", "device offline for
  6 hours", "emergency override used"), with times;
- the names of your paired devices.

They never see URLs, page titles, app or window names, search terms, message
content or anything on your screen. Each client has a "What your guardian
sees" screen with a real example of that data. Guardians cannot change your
rules or send commands to your devices. You can end the guardianship from your
device at any time; the guardian receives a neutral notice. Guardian access
expires unless you re-confirm it on your device every 30 days.

## LLM features (optional)

The server can generate a weekly report and, if enabled, a digest of sources
you choose. Both are **off unless you or your server operator enable them**,
and the settings name the external provider before you opt in.

- **Weekly report:** the provider receives aggregates only: minutes per
  category, your top domains or apps by time, daily scores, counts of unlocks
  and bypasses, and your goals. No URLs, titles or event-level data.
- **Digest:** the provider receives public posts fetched from the sources you
  picked; none of your activity data is included.
- The provider's own retention and training policy applies to what it
  receives; check it before enabling these features. The API key lives only on
  the server.

## Retention

| Data                            | Default retention                              |
| ------------------------------- | ---------------------------------------------- |
| Raw activity events on a client | 30 days                                        |
| Activity blocks on a client     | Until you delete them                          |
| Server heartbeats               | 30 days                                        |
| Server activity blocks          | 400 days (configurable by the server operator) |
| Digest items on the server      | 14 days                                        |
| Unlock and bypass audit trail   | Kept with the account until it is deleted      |

Deleting your account on the server removes all of its data and notifies your
guardian that the link ended.

## Export and deletion

- Each client can export its data (ActivityWatch-compatible JSON) and delete it.
- The server offers `GET /me/export` and account deletion from the dashboard.

## Transport and storage security

All traffic to a server uses TLS; clients refuse cleartext connections. Device
tokens live in the platform keystore (Android Keystore, macOS Keychain). See
[SECURITY.md](SECURITY.md) and [docs/threat-model.md](docs/threat-model.md).

## Questions

Open an issue for privacy questions, or report a privacy vulnerability
privately as described in [SECURITY.md](SECURITY.md).
