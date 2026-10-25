# `@monki-focus/api`

The optional, self-hostable monki-focus server (AdonisJS 7, Postgres 17,
ntfy): guardian unlocks, analytics sync and reports. Every client works
without it; the server adds a guardian, sync across devices and a dashboard.

Today it is the scaffold (work package S1): boot-time env validation, health
probes, logger redaction, i18n, CSRF and CSP, rate limits in Postgres, the
in-process scheduler with `scheduler_runs` claims and the `/api/v1` device
gate (`X-Client-Version`, 426 for old clients). Accounts, devices, guardians
and unlocks arrive with S2 to S8.

## Run it

```bash
# from the repo root
docker compose up -d db ntfy                 # Postgres :5442, ntfy :8442
cp server/api/.env.example server/api/.env
(cd server/api && node ace generate:key && node ace migration:run)
npm run dev -w server/api                    # http://localhost:3433

# or the production image with everything
GIT_SHA="$(git rev-parse HEAD)" docker compose up -d --build
curl -s localhost:3433/api/health            # { status, version, sha, checks }
```

## Test it

```bash
npm run test:services -w server/api          # ephemeral Postgres :5443 + ntfy :8443 (tmpfs)
npx turbo run lint typecheck test build --filter=@monki-focus/api
npm run test:services:down -w server/api
bash scripts/e2e.sh                          # the E2E slot stack (after a build)
npm run smoke:local -w server/api            # Bruno smoke against :3433
```

Suites (`adonisrc.ts`): `unit` (no database: domain, env, logging, i18n
parity, architecture) and `functional` (real Postgres migrated once, one
global transaction per test, HTTP server). Test names read like specs.

## Layout

| Path                   | What                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `start/env_schema.ts`  | Every variable, validated at boot; `.env.example` documents the same list  |
| `start/routes.ts`      | `/api/health`, `/api/health/live`, `/api/v1` (device group), `/api/test/*` |
| `app/domain/`          | Pure modules: no framework, no I/O, no implicit clock (architecture spec)  |
| `app/http/`            | Client IP (`CLIENT_IP_HEADER`), trusted proxies, CSRF exemptions, locales  |
| `app/logging/`         | Redaction of tokens, codes, capabilities, credentials and emails           |
| `app/scheduler/`       | 60 s in-process scheduler and `scheduler_runs` claims                      |
| `app/middleware/`      | JSON, locale, `X-Client-Version` gate                                      |
| `resources/lang/`      | `en` and `es` catalogs (parity test)                                       |
| `bruno/`               | Smoke collection (`npm run smoke:local`, `smoke:prod`)                     |
| `database/migrations/` | Additive only, prefix `17930000000NN_`                                     |

## Deploy notes

- The image (`Dockerfile`, final stage `runtime`) listens on 3333, runs as
  `node`, has no volume and probes `/api/health` with Node's fetch.
- `docker/entrypoint.mjs` migrates when `MIGRATE_ON_START=true`, seeds when
  `SEED_USERS=true`, then starts the server in the same process.
- Behind a CDN or proxy, set `CLIENT_IP_HEADER` to the header your proxy
  overwrites (for example `cf-connecting-ip`); it is trusted only from
  loopback or private peers.
