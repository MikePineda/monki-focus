// SPDX-License-Identifier: AGPL-3.0-or-later
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { SeedPlan, SeedUser } from '#services/bootstrap/seed_plan'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Applies a seed plan. Idempotent by email: an existing account keeps its
 * password and settings (re-running never resets anything), and an
 * existing admin email is (re)promoted to admin. The smoke user is never an
 * admin. Logs ids, never emails.
 */
export default class ProductionBootstrap {
  async run(plan: SeedPlan) {
    return db.transaction(async (trx) => {
      const admin = plan.admin ? await this.ensureUser(plan.admin, true, trx) : null
      const smoke = plan.smoke ? await this.ensureUser(plan.smoke, false, trx) : null
      return { admin, smoke }
    })
  }

  protected async ensureUser(person: SeedUser, isAdmin: boolean, trx: TransactionClientContract) {
    const existing = await User.query({ client: trx }).where('email', person.email).first()
    if (existing) {
      if (isAdmin && !existing.isAdmin) {
        existing.isAdmin = true
        await existing.save()
        logger.info({ userId: existing.id }, 'production bootstrap: promoted to admin')
      }
      return existing
    }

    const user = await User.create(
      {
        email: person.email,
        fullName: person.fullName,
        password: person.password,
        locale: person.locale,
        timeZone: person.timeZone,
        weekStart: 1,
        isAdmin,
        sessionVersion: 0,
      },
      { client: trx }
    )
    logger.info({ userId: user.id, isAdmin }, 'production bootstrap: user created')
    return user
  }
}
