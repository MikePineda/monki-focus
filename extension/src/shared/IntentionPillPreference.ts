// SPDX-License-Identifier: AGPL-3.0-or-later

/** `storage.local` key of the "show the time left" setting (default on). */
export const INTENTION_PILL_STORAGE_NAME = 'gate.intentionPill'

interface StorageReader {
  get(key: string): Promise<Record<string, unknown>>
}

/** Whether pages show the intention's `mm:ss` pill; only an explicit `false` turns it off. */
export async function readIntentionPillPreference(storage: StorageReader): Promise<boolean> {
  return (await storage.get(INTENTION_PILL_STORAGE_NAME))[INTENTION_PILL_STORAGE_NAME] !== false
}
