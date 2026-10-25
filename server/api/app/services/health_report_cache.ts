// SPDX-License-Identifier: AGPL-3.0-or-later

/** How long one readiness run answers every probe. */
export const HEALTH_CACHE_TTL_MS = 1000

/**
 * Keeps one readiness run for a short time, so a burst of public probes
 * (or someone hammering `/api/health`) costs one database round trip per
 * second instead of one per request. Concurrent callers share the run in
 * flight; a run that throws is not kept. `now` is a monotonic clock in ms.
 */
export class HealthReportCache<Report> {
  #value: Promise<Report> | null = null
  #at = 0

  constructor(
    protected now: () => number,
    protected ttlMs: number = HEALTH_CACHE_TTL_MS
  ) {}

  get(run: () => Promise<Report>): Promise<Report> {
    const now = this.now()
    if (this.#value && now - this.#at < this.ttlMs) return this.#value
    this.#at = now
    const value = run()
    this.#value = value
    value.catch(() => {
      if (this.#value === value) this.#value = null
    })
    return value
  }
}
