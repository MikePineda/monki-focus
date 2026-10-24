# ADR 0003: Guardian notifications through ntfy with capability actions

- Status: accepted
- Date: 2026-10-25

## Context

A guardian must be able to approve or deny an unlock request quickly from a
phone, often with the dashboard closed. Building and operating our own push
service per platform is out of scope for a self-hosted project, and
self-hosters should not need accounts with Google or Apple push services.

## Decision

Use a self-hosted **ntfy** instance next to the server:

- ntfy runs with `auth-default-access: deny-all`. The server holds a
  write-only token; each guardian gets read access to exactly one random topic
  (a `mf-` prefix plus about 130 bits of base32), so the topic name works as a
  capability. Users, ACLs and tokens are declared through environment
  variables, so ntfy needs no volume.
- Each unlock request is published with up to three actions: an `http` POST to
  approve, an `http` POST to deny, and a `view` link to the request in the
  dashboard. The approve and deny URLs carry **single-use capabilities** of
  256 bits, stored only as hashes, bound to
  `(request_id, guardian_id, decision)`, valid for at most 15 minutes.
  Consuming one invalidates both, in a transaction that locks the request.
- A GET never mutates; a GET on an action URL only shows a confirmation page.
- Publishing failures go to an outbox with retries.
- A strict mode (`allow_notification_actions = false`) sends only the `view`
  action, forcing approval through an authenticated dashboard session.

## Consequences

- Works on Android natively and on iOS through ntfy's upstream relay, with no
  vendor push accounts for self-hosters.
- Anyone who obtains a notification can act on it within the capability's
  short lifetime; the strict mode exists for guardians who want stronger
  guarantees.
- A server administrator could still approve their own requests; this residual
  risk is documented and addressed in P2 with passkey co-signed approvals (see
  [BACKLOG.md](../BACKLOG.md)).
