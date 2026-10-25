// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Storage of the `@adonisjs/limiter` database store (the shape
 * rate-limiter-flexible requires). Keeps throttling correct across replicas
 * and restarts without Redis. Keys are built from route names and client
 * IPs or ids, never from emails in clear.
 */
export default class extends BaseSchema {
  protected tableName = 'rate_limits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key', 255).notNullable().primary()
      table.integer('points', 9).notNullable().defaultTo(0)
      table.bigint('expire').unsigned()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
