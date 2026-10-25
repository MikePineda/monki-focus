// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LucidModel } from '@adonisjs/lucid/types/model'

/**
 * Tenant isolation for every resource that hangs from a user. Routes with
 * an `:id` or `:uuid` load rows only through these, so someone else's row
 * is indistinguishable from a missing one: `firstOrFail` throws
 * `E_ROW_NOT_FOUND`, which answers **404, never 403**.
 *
 * - Constrain params in the route (`router.matchers.number()` / `.uuid()`):
 *   a malformed id is then a 404 too, never a 500 from Postgres.
 * - Guardians reach a ward's data only through an active guardianship
 *   (later packages), never through these helpers with the ward's id.
 *
 * tests/functional/tenant_isolation.spec.ts hits every route with a param
 * using another user's id and fails when a new one has no case.
 */
export function ownedBy<Model extends LucidModel>(
  model: Model,
  owner: { id: number },
  column = 'user_id'
) {
  return model.query().where(column, owner.id)
}

/** The row with `key = value` owned by `owner`, or a 404. */
export function findOwnedOrFail<Model extends LucidModel>(
  model: Model,
  owner: { id: number },
  value: number | string,
  options: { column?: string; key?: string } = {}
) {
  return ownedBy(model, owner, options.column)
    .where(options.key ?? 'id', value)
    .firstOrFail()
}
