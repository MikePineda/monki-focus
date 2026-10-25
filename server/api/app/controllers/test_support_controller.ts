// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import Clock from '#services/clock'
import type { HttpContext } from '@adonisjs/core/http'
import { Scheduler } from '#scheduler/scheduler'
import { scheduledJobs } from '#scheduler/scheduled_jobs'

/**
 * Test-support endpoints (NODE_ENV=test or E2E_MODE only, see
 * start/routes.ts). Session routes like any other: CSRF applies.
 */
export default class TestSupportController {
  /** Runs one scheduler tick now, so E2E journeys do not wait for the 60 s timer. */
  async tick({ logger }: HttpContext) {
    const jobs = await scheduledJobs(app)
    const clock = await app.container.make(Clock)
    await new Scheduler(jobs, () => clock.now(), logger).tick()
    return { jobs: jobs.map((job) => job.name) }
  }
}
