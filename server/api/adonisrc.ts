// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  |
  | Ace commands registered from packages. Application commands are scanned
  | from the "./commands" directory.
  |
  */
  commands: [() => import('@adonisjs/core/commands'), () => import('@adonisjs/lucid/commands')],

  /*
  |--------------------------------------------------------------------------
  | Service providers
  |--------------------------------------------------------------------------
  |
  | No mail or drive: passwords are reset with `node ace user:reset-password`.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('#providers/pg_types_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/i18n/i18n_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    // Signing keys, the unlock-token ledger and token issuance; checks the keys on web boot.
    () => import('#providers/signing_keys_provider'),
    // The `bypassAlerts` port (device bypass events to the guardian, S6).
    () => import('#providers/devices_provider'),
    {
      // The HTTP server only (production, unless SCHEDULER=off): never ace or tests.
      file: () => import('#providers/scheduler_provider'),
      environment: ['web'],
    },
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  */
  preloads: [() => import('#start/routes'), () => import('#start/kernel')],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  |
  | unit: no database, no HTTP server. functional: real Postgres (migrated
  | once per run, one global transaction per test) and the HTTP server.
  |
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.{ts,js}'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  /*
  |--------------------------------------------------------------------------
  | Metafiles
  |--------------------------------------------------------------------------
  |
  | Files copied to the production build next to the compiled code.
  |
  */
  metaFiles: [
    {
      pattern: 'resources/lang/**/*.{json,yaml,yml}',
      reloadServer: false,
    },
  ],
})
