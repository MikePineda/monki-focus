// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The dead-man switch: a protected device that stops reporting is the one
 * bypass a device cannot report itself (uninstalled, force-stopped, safe
 * mode, factory reset, network cut). The guardian hears of it once per gap
 * (`heartbeat_missing`) and once more when the device is back
 * (`heartbeat_resumed`, with the gap's length). A planned shutdown the
 * device announced (`goingOffline`) labels the alert; it never suppresses
 * it. Times are whole epoch seconds.
 */

export const DEADMAN_HOURS_MIN = 1
export const DEADMAN_HOURS_MAX = 48
export const DEADMAN_HOURS_DEFAULT = 6

export interface DeadmanSubject {
  readonly protectionActive: boolean
  readonly revoked: boolean
  /** Last heartbeat (or the enrolment), epoch seconds. */
  readonly lastSeenAt: number
  readonly deadmanHours: number
  /** When the device last announced a planned shutdown, if it did since its last heartbeat. */
  readonly announcedOfflineAt: number | null
}

/** When a quiet device becomes overdue: its last heartbeat plus its threshold. */
export function overdueAt(subject: DeadmanSubject): number {
  return subject.lastSeenAt + subject.deadmanHours * 3600
}

/**
 * True when the guardian must hear the device went quiet: protection was
 * on, the device is not revoked, and no heartbeat came for its threshold.
 * A device that never turned protection on, or whose user turned it off,
 * never triggers.
 */
export function isOverdue(subject: DeadmanSubject, now: number): boolean {
  return subject.protectionActive && !subject.revoked && now >= overdueAt(subject)
}

/** Whether the gap started with an announced shutdown (labels the alert). */
export function wasAnnounced(subject: DeadmanSubject): boolean {
  return subject.announcedOfflineAt !== null && subject.announcedOfflineAt >= subject.lastSeenAt
}

/** Length of a gap that ended with a heartbeat at `resumedAt`. */
export function gapSeconds(lastSeenAt: number, resumedAt: number): number {
  return Math.max(0, resumedAt - lastSeenAt)
}

export function isDeadmanHours(value: number): boolean {
  return Number.isInteger(value) && value >= DEADMAN_HOURS_MIN && value <= DEADMAN_HOURS_MAX
}
