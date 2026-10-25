// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { LOG_PRIVACY } from '#logging/log_redaction'
import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME') ?? 'monki-focus',
      level: env.get('LOG_LEVEL'),

      /**
       * Tokens, codes, capabilities, credentials, headers and emails are
       * censored before a line is written (app/logging/log_redaction.ts).
       */
      ...LOG_PRIVACY,

      /** Synchronous writes outside production, so test output is never lost. */
      destination: !app.inProduction ? await syncDestination() : undefined,

      /** JSON lines on stdout; the platform collects them. */
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
