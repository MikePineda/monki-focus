# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# monki-focus server image: one image, one process (HTTP server plus the
# in-process scheduler). Stateless: no volume, everything lives in Postgres.
# Build context is the repository root.
#
#   docker build --target runtime --build-arg GIT_SHA="$(git rev-parse HEAD)" \
#     -t monki-focus-server:local .
#
# Deploy platforms (Dokploy) always pass --target, so the final stage must
# stay named `runtime`. Base images are pinned by digest (Dependabot bumps
# them). Production is ARM64 and builds natively there.

ARG NODE_IMAGE=node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205

########################################################################
# gitsha: the commit being built. A GIT_SHA build arg wins; otherwise the
# HEAD of the checkout in the build context (bind-mounted, never copied),
# else "unknown" (for example a git worktree, whose .git is a pointer).
########################################################################
FROM alpine/git:v2.54.0@sha256:4fac439ee3b9204bec99c712b8a15942999632458f716ae8149fbb97cb760cd4 AS gitsha
ARG GIT_SHA=""
RUN --mount=type=bind,target=/src \
    if [ -n "$GIT_SHA" ]; then echo "$GIT_SHA"; \
    else git -c safe.directory='*' -C /src rev-parse --verify -q HEAD 2>/dev/null || echo unknown; \
    fi > /git-sha

########################################################################
# manifests: every workspace package.json at its path (npm ci checks the
# lockfile against all of them). Its output only changes when a manifest
# does, so the install layers below stay cached on code-only changes.
########################################################################
FROM ${NODE_IMAGE} AS manifests
WORKDIR /src
RUN --mount=type=bind,target=/ctx \
    cd /ctx && find . -name package.json -not -path '*/node_modules/*' \
      -exec sh -c 'mkdir -p "/src/$(dirname "$1")" && cp "$1" "/src/$1"' _ {} \; \
    && cp package-lock.json /src/

########################################################################
# deps: the server workspace's full install (dev dependencies included)
# for the build. No install scripts run (same policy as CI).
########################################################################
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY --from=manifests /src ./
RUN npm ci -w server/api --ignore-scripts --no-audit --no-fund

########################################################################
# build: compile the workspace packages the server imports at runtime
# (@monki-focus/protocol: token signing and verification), then the server
# (TypeScript -> build/), and stamp its version (release-please bumps
# server/api/package.json).
########################################################################
FROM deps AS build
COPY packages/protocol/package.json packages/protocol/tsconfig.json packages/protocol/tsconfig.build.json ./packages/protocol/
COPY packages/protocol/src ./packages/protocol/src
RUN node_modules/.bin/tsc -p packages/protocol/tsconfig.build.json
COPY server/api ./server/api
RUN cd server/api && node ace build \
 && node -p "require('./package.json').version" > build/.app-version \
 && rm -rf build/tests

########################################################################
# prod-deps: runtime dependencies only, workspace layout kept as is so
# packages hoisted to /app/node_modules resolve from server/api/build.
# --omit=optional drops tools that are optional peers of runtime packages.
########################################################################
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY --from=manifests /src ./
RUN npm ci -w server/api --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund \
 && mkdir -p server/api/node_modules

########################################################################
# runtime
########################################################################
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    TZ=UTC \
    HOST=0.0.0.0 \
    PORT=3333 \
    NODE_OPTIONS=--max-old-space-size=384
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/api/node_modules ./server/api/node_modules
COPY --from=build /app/packages/protocol/package.json ./packages/protocol/package.json
COPY --from=build /app/packages/protocol/dist ./packages/protocol/dist
COPY --from=build /app/server/api/build ./server/api/build
COPY --from=gitsha /git-sha ./server/api/build/.git-sha
COPY docker/entrypoint.mjs ./server/api/build/entrypoint.mjs
# COPY creates root-owned files: the app user (node) can read but not modify
# the code. No chown layer, which would duplicate node_modules.
WORKDIR /app/server/api/build
USER node
EXPOSE 3333
# No curl in the image: probe readiness with Node's fetch.
HEALTHCHECK --interval=10s --timeout=6s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "entrypoint.mjs"]
