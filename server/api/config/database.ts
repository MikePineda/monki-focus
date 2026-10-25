// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const connection = {
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD')?.release(),
  database: env.get('DB_DATABASE'),
}

/** Pool of the limiter's own connection (see `limiter` below). */
export const LIMITER_POOL_MAX = 2

const dbConfig = defineConfig({
  connection: 'postgres',

  connections: {
    postgres: {
      client: 'pg',
      connection,
      pool: {
        min: 0,
        max: env.get('DB_POOL_MAX') ?? 10,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      // No schema generation: the image is read-only for the app user and
      // the infrastructure tables (rate limits, scheduler claims) have no model.
      schemaGeneration: {
        enabled: false,
      },
      debug: app.inDev && env.get('LOG_LEVEL') === 'debug',
    },

    /**
     * The same database for the limiter store only (`rate_limits`), so its
     * counters are always committed on their own and never join (or roll
     * back with) another query's transaction, the test suite's global one
     * included. Small pool: one upsert per throttled request.
     */
    limiter: {
      client: 'pg',
      connection,
      pool: { min: 0, max: LIMITER_POOL_MAX },
      schemaGeneration: { enabled: false },
    },
  },
})

export default dbConfig
