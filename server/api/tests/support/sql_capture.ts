// SPDX-License-Identifier: AGPL-3.0-or-later
import db from '@adonisjs/lucid/services/db'

/**
 * Every SQL statement the app sends while `run` runs (requests served in
 * this process included), lowercased, in order. Lock-order specs read it:
 * concurrency cannot deadlock inside the suite's single global
 * transaction, so they prove the order the locks are taken in instead.
 */
export async function captureSql(run: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = []
  const knex = db.connection().getWriteClient()
  const listener = (query: { sql: string }) => seen.push(query.sql.toLowerCase())
  knex.on('query', listener)
  try {
    await run()
  } finally {
    knex.removeListener('query', listener)
  }
  return seen
}

/** Index of the first statement matching every pattern, or -1. */
export function firstIndex(statements: readonly string[], ...patterns: RegExp[]): number {
  return statements.findIndex((sql) => patterns.every((pattern) => pattern.test(sql)))
}
