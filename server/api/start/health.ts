// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| Health checks
|--------------------------------------------------------------------------
|
| Checks behind the readiness probe (GET /api/health). No disk check: the
| container is stateless and has no volume. Heap thresholds are relative to
| --max-old-space-size in the Dockerfile.
|
| Built per run (cheap) so the database check always uses the current
| connection client, including inside the test suite's global transactions.
|
*/

import db from '@adonisjs/lucid/services/db'
import { DbCheck } from '@adonisjs/lucid/database'
import { HealthChecks, MemoryHeapCheck } from '@adonisjs/core/health'

export function runHealthChecks() {
  return new HealthChecks()
    .register([
      new DbCheck(db.connection()).as('database'),
      new MemoryHeapCheck()
        .warnWhenExceedsPercentage(80)
        .failWhenExceedsPercentage(95)
        .as('memory_heap'),
    ])
    .run()
}
