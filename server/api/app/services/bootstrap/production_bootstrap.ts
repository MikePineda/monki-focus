// SPDX-License-Identifier: AGPL-3.0-or-later
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { SeedPlan, SeedUser } from '#services/bootstrap/seed_plan'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Applies a seed plan. Idempotent by email: an existing account keeps its
 * password and settings (re-running never resets anything). An existing
 * account with the admin email is kept (and promoted) only when its
 * password is SEED_ADMIN_PASSWORD; otherwise the run fails without
 * changing anything. The smoke user is never an admin. Errors and logs
 * name variables and ids, never emails or passwords.
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
      // Whoever controls SEED_ADMIN_EMAIL must not take over (or promote)
      // an account someone else registered: the stored hash has to match.
      if (isAdmin && !(await existing.verifyPassword(person.password))) {
        throw new Error(
          'Invalid production bootstrap: an account with SEED_ADMIN_EMAIL already exists and ' +
            'SEED_ADMIN_PASSWORD does not match it; nothing was changed. Set the right ' +
            'SEED_ADMIN_PASSWORD, reset that account with `node ace user:reset-password`, ' +
            'or turn SEED_USERS off.'
        )
      }
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
        guardianOnly: false,
        sessionVersion: 0,
      },
      { client: trx }
    )
    logger.info({ userId: user.id, isAdmin }, 'production bootstrap: user created')
    return user
  }
}
