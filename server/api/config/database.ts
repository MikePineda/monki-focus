// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',

  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD')?.release(),
        database: env.get('DB_DATABASE'),
      },
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
  },
})

export default dbConfig
