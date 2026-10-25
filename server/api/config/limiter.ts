// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Rate limits live in Postgres (`rate_limits`), so they hold across
 * replicas and restarts without Redis. The test suite uses memory.
 */
const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    database: stores.database({
      tableName: 'rate_limits',
    }),
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
