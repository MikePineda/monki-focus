// SPDX-License-Identifier: AGPL-3.0-or-later
import { runHealthChecks } from '#start/health'
import type { HttpContext } from '@adonisjs/core/http'
import { currentBuildInfo } from '#services/build_info'
import { HealthReportCache } from '#services/health_report_cache'

/** One readiness run per second at most, whoever asks (monotonic clock). */
const readiness = new HealthReportCache<Awaited<ReturnType<typeof runHealthChecks>>>(() =>
  performance.now()
)

type CheckStatus = 'ok' | 'warning' | 'error'

export interface HealthReport {
  status: CheckStatus
  version: string
  sha: string
  checks: Record<string, { status: CheckStatus }>
}

/**
 * Probes for Docker/Swarm, uptime monitors and the post-deploy smoke test.
 * Public on purpose, so they expose statuses only: no messages, metadata or
 * process details (those go to the logs when a check fails).
 */
export default class HealthChecksController {
  /** Readiness: 200 when every check passes (warnings included), 503 otherwise. */
  async ready({ response, logger }: HttpContext): Promise<HealthReport> {
    const [report, build] = await Promise.all([readiness.get(runHealthChecks), currentBuildInfo()])

    const checks: HealthReport['checks'] = {}
    for (const check of report.checks) {
      checks[check.name] = { status: check.status }
    }

    if (!report.isHealthy) {
      logger.error({ checks: report.checks }, 'readiness probe failed')
      response.status(503)
    }

    return { status: report.status, version: build.version, sha: build.sha, checks }
  }

  /** Liveness: the process is up and serving requests. Touches nothing else. */
  async live() {
    return { status: 'ok' as const }
  }
}
