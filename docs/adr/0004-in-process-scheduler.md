# ADR 0004: In-process scheduler, no separate worker

- Status: accepted
- Date: 2026-10-25

## Context

The server runs periodic jobs: expiring unlock requests, dispatching the ntfy
outbox, the dead-man check, goal evaluation, the weekly report, the digest and
data pruning. Self-hosters should be able to run the server as a single
container next to Postgres and ntfy.

## Decision

Run jobs in the API process with a scheduler that ticks every 60 seconds. Each
run is claimed in a `scheduler_runs` table with `INSERT … ON CONFLICT`, keyed
by job and period (for example `goal:<id>:<local-date>` or the ISO week for the
weekly report), so overlapping instances during a rolling update never run a
job twice. Failed runs record their error and can be retried with a delay (for
example after an LLM rate limit).

## Consequences

- One process and one image to deploy; no queue broker.
- Jobs must stay short and idempotent; a long or blocking job (for example a
  slow LLM call) would delay the tick. If that happens, the job moves to a
  separate worker process using the same claim table, without changing the
  job code.
- Running more than one replica is safe because of the claims, though not
  needed today.
