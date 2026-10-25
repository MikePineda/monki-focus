// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * At most one pending (unused) enrolment code per user, enforced by the
 * database: two concurrent "new code" requests can no longer leave two
 * guessable codes behind. The service also serialises them on the user row
 * and replaces the previous code in the same transaction.
 */
export default class extends BaseSchema {
  protected tableName = 'device_enrollment_codes'

  async up() {
    this.schema.raw(
      `CREATE UNIQUE INDEX device_enrollment_codes_pending_user
         ON ${this.tableName} (user_id) WHERE used_at IS NULL`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX device_enrollment_codes_pending_user')
  }
}
