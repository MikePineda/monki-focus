// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The user's own local data leaving or being erased through the user's own
 * action (options page, Stats). `activitywatch`: the raw events in the
 * ActivityWatch export format (`@monki-focus/analytics`); `csv`: the
 * 5-minute blocks, one row per block.
 */
export const EXPORT_FORMATS = ['activitywatch', 'csv'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export interface ExportedFile {
  fileName: string
  mimeType: string
  text: string
}

export interface DeletedLocalData {
  /** Object stores that were emptied. */
  stores: string[]
}
