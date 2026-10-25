// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Loads `.env` (and `.env.test` under NODE_ENV=test; process variables win
| over both), validates every variable against start/env_schema.ts and the
| cross-variable rules, and exports the typed reader. Imported while the app
| boots (bin/*.ts), so a bad value never reaches a request.
|
*/

import { Env } from '@adonisjs/core/env'
import { crossFieldProblems, envSchema } from '#start/env_schema'

const env = await Env.create(new URL('../', import.meta.url), envSchema)

const problems = crossFieldProblems({
  NODE_ENV: env.get('NODE_ENV'),
  E2E_MODE: env.get('E2E_MODE'),
  HOST: env.get('HOST'),
  APP_URL: env.get('APP_URL'),
  APP_KEY_LENGTH: env.get('APP_KEY').release().length,
  UNLOCK_SIGNING_KEY: env.get('UNLOCK_SIGNING_KEY')?.release(),
  UNLOCK_SIGNING_KEY_ID: env.get('UNLOCK_SIGNING_KEY_ID'),
})
if (problems.length > 0) {
  throw new Error(`Invalid environment:\n- ${problems.join('\n- ')}`)
}

export default env
