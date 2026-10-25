// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { readSeedPlan } from '#services/bootstrap/seed_plan'
import ProductionBootstrap from '#services/bootstrap/production_bootstrap'

/**
 * Deploy-time bootstrap, run by docker/entrypoint.mjs when SEED_USERS=true
 * (`node ace db:seed --files=./database/seeders/production_bootstrap_seeder.js`):
 * the first admin from SEED_ADMIN_* and the smoke user from SMOKE_*. Real
 * names and emails exist only in the deploy panel. Idempotent, so leaving
 * SEED_USERS on for a redeploy is harmless; a weak password fails the run
 * and the container refuses to start.
 */
export default class ProductionBootstrapSeeder extends BaseSeeder {
  async run() {
    if (env.get('SEED_USERS') !== true) {
      logger.info('production bootstrap skipped (SEED_USERS is off)')
      return
    }

    const plan = readSeedPlan({
      SEED_ADMIN_EMAIL: env.get('SEED_ADMIN_EMAIL'),
      SEED_ADMIN_NAME: env.get('SEED_ADMIN_NAME'),
      SEED_ADMIN_PASSWORD: env.get('SEED_ADMIN_PASSWORD')?.release(),
      SEED_ADMIN_LOCALE: env.get('SEED_ADMIN_LOCALE'),
      SEED_ADMIN_TIME_ZONE: env.get('SEED_ADMIN_TIME_ZONE'),
      SMOKE_EMAIL: env.get('SMOKE_EMAIL'),
      SMOKE_PASSWORD: env.get('SMOKE_PASSWORD')?.release(),
    })

    const { admin, smoke } = await new ProductionBootstrap().run(plan)
    logger.info(
      { adminId: admin?.id ?? null, smokeUserId: smoke?.id ?? null },
      'production bootstrap done'
    )
  }
}
