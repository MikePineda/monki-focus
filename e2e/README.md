# `@monki-focus/e2e`

Playwright journeys across the dashboard, the extension and the server
(arrive with phase 3). Today this folder holds the server environment of the
E2E stack (`e2e.env`), which `scripts/e2e.sh` sources.

`scripts/e2e.sh` gives every run its own slot (compose project, ports,
report folders), brings up Postgres and ntfy from `docker-compose.test.yml`,
migrates, starts the compiled server and, once `playwright.config.ts`
exists, runs Playwright against it:

| Slot | API    | Postgres | ntfy   |
| ---- | ------ | -------- | ------ |
| 0    | 3434   | 5434     | 8434   |
| N    | 3434+N | 5434+N   | 8434+N |

Slots run from 0 to 7. Build the server first
(`npx turbo run build --filter=@monki-focus/api`).
