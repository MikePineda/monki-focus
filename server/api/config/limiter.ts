// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * The Postgres store (`rate_limits`). `clearExpiredByTimeout` deletes
 * expired rows every 5 minutes, so keys from one-off IPs never pile up.
 */
export const databaseStoreOptions = {
  tableName: 'rate_limits',
  clearExpiredByTimeout: true,
}

/**
 * Rate limits live in Postgres, so they hold across replicas and restarts
 * without Redis. The test suite uses memory.
 */
const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    database: stores.database(databaseStoreOptions),
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
