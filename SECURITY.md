# Security policy

monki-focus handles sensitive signals (what someone does on their devices,
and who they trust to hold a key). We take reports seriously and fix them in
the open once users are protected.

## Reporting a vulnerability

Report privately through
[GitHub Private Vulnerability Reporting](https://github.com/MikePineda/monki-focus/security/advisories/new).
Do not open a public issue, pull request or discussion for a vulnerability.

Please include:

- the affected component and version (extension and app "About" screens, or
  `GET /api/health` on a server), or the commit;
- steps to reproduce, and what an attacker gains;
- whether you have shared the finding with anyone else.

Do not include real personal data in a report; synthetic examples are enough.

### What to expect

| Step                           | Target                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| Acknowledgement                | within **72 hours**                                                    |
| Triage and severity assessment | within **7 days**                                                      |
| Fix and coordinated disclosure | within **90 days** of the report, sooner for actively exploited issues |

We keep you informed during the process, agree on a disclosure date with you,
publish a GitHub Security Advisory with the fix, and credit you unless you
prefer to stay anonymous.

### Safe harbour

We will not pursue or support legal action against good-faith research that
follows this policy: test only against your own devices, accounts and
self-hosted instances; avoid privacy violations, data destruction and service
degradation; and give us reasonable time to fix before disclosure.

## Supported versions

The project is pre-alpha and has no releases yet. Once releases exist:

- each component (extension, Android, macOS, server) receives security fixes
  on its **latest minor release** only;
- self-hosters are expected to run the latest server release;
- clients older than the server's minimum supported version are refused by
  the server and asked to update.

## Scope

**In scope**

- The server and web dashboard (`server/`), including authentication,
  pairing, guardianship, unlock approvals and tenant isolation.
- The clients: browser extension, Android app, macOS app and the native
  messaging bridge.
- Unlock-token and policy signing and verification (`packages/protocol`), and
  the signed rules feed (`packages/rules`).
- The build, release and CI pipeline (GitHub Actions, release artefacts,
  container images).

**Out of scope**

- **Self-bypass by the device or server administrator.** monki-focus is a
  commitment device, not DRM. A user with admin or root access to their own
  device, or who administers the server, can defeat it (for example by editing
  the database or factory-resetting a phone). This is a documented residual
  risk; the design makes bypasses visible to the guardian rather than
  impossible. Reports that make a bypass _silent_ (undetected and unreported)
  are in scope.
- Volumetric denial of service.
- Third-party instances run by other people, and vulnerabilities in upstream
  dependencies that have no impact on monki-focus (report those upstream).
- Social engineering of maintainers or users.

## Anti-stalkerware stance

monki-focus is a self-commitment tool, installed **by and for the person who
owns the device**. It must never work as spyware or as a tool for coercive
control. The following are treated as **high-severity vulnerabilities**, not
feature requests:

- any way to install, pair or run it without the monitored person's informed
  confirmation on their own device;
- any way to hide the app, its launcher icon or its persistent notification;
- any way to prevent the monitored person from leaving: unpairing must always
  be possible from the device, with a short waiting period and a neutral
  notice to the guardian (on the server, the guardian stops seeing anything
  the moment the person asks to leave, and only keeps approving unlocks
  until the waiting period ends);
- any way for a guardian to see more than the documented guardian view (focus
  score, unlock requests and bypass events), such as URLs, page titles, app
  content or screen text;
- any way for a guardian to change rules or send remote commands;
- any path to keep guardian access without the periodic re-consent on the
  monitored device.

Pull requests that add hidden modes, covert installation or remote control
will not be accepted.

If you are worried that someone is using software to monitor you without your
consent, the [Coalition Against Stalkerware](https://stopstalkerware.org) has
guidance and links to local support services.

## Verifying releases

Release verification is documented here once the first releases ship. It will
cover:

- the Android APK signing-certificate fingerprint;
- build provenance attestations (`gh attestation verify`) for the APK, the
  macOS archive, the extension zip and the server image;
- the `sha256` pinned in the Homebrew cask;
- the public key that signs the rules feed.

## Data handling

What each component collects, what a guardian sees, what is sent to an LLM
provider and how long data is kept are described in [PRIVACY.md](PRIVACY.md).
The threat model behind these rules is in
[docs/threat-model.md](docs/threat-model.md).
