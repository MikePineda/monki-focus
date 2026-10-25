# Bruno smoke collection

Living docs of the server and the post-deploy smoke test, as plain-text `.bru`
files versioned with the code. The device API contract itself is
`packages/protocol/openapi.yaml`; this collection proves a running instance
answers.

| Request          | What it proves                                                              |
| ---------------- | --------------------------------------------------------------------------- |
| `01-health`      | `GET /api/health`: 200, database up, `version` + `sha`, CSP and frame guard |
| `02-health-live` | `GET /api/health/live`: the process answers                                 |
| `03-keys`        | `GET /api/v1/keys`: one active key per purpose, public material only        |

Later work packages add `04-config`, the smoke user's login, its
reads and logout, and a device heartbeat with the smoke device token.

## Run it

```bash
docker compose up -d --build           # local stack on http://localhost:3433
npm run smoke:local -w server/api
npm run smoke:prod -w server/api       # against SMOKE_BASE_URL, after every deploy
```

Both call `server/api/bin/smoke.sh <env>`, which runs a pinned
`@usebruno/cli` with `--bail`. Extra flags pass through.

Credentials and the production URL come from the shell or from
`server/api/bruno/.env` (gitignored; Bruno loads it as `process.env`):
`SMOKE_BASE_URL` (`https://<your-instance>`, no trailing slash),
`SMOKE_EMAIL`, `SMOKE_PASSWORD` and `SMOKE_DEVICE_TOKEN`. Environments only
reference them (`{{process.env.SMOKE_EMAIL}}`); never type a secret or a
domain into a `.bru` file. Personal overrides go in
`environments/*.local.bru` (gitignored).

## Rules every request follows

1. **Browser-like `User-Agent`** (set in `collection.bru`): CDNs with a
   browser integrity check answer 403 to obvious scripts.
2. **CSRF on session routes: GET first, then `X-XSRF-TOKEN: {{xsrfToken}}`**.
   The collection's post-response script keeps the newest `XSRF-TOKEN`
   cookie. Device routes (`/api/v1/device/*`) use the Bearer smoke device
   token instead and send `X-Client-Version`.
3. **Production is read-only.** Against `prod` only GETs run (plus the smoke
   user's own login and logout once they exist); the pre-request script
   skips every other write.

## Add a request

Create `NN-name.bru` with the next `seq` (keep the file prefix and `seq`
equal), assert the contract (status, shape, invariants) rather than
incidental data, run `npm run smoke:local -w server/api` and commit it with
the change that needed it.
