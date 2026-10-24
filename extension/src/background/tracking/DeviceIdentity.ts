// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'

/** `browser.storage.local` key of this install's random device id. */
export const DEVICE_ID_STORAGE_NAME = 'device.id'

const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set'>

/**
 * A random id per install (a UUID), created on first use. It names this
 * device's blocks and event bucket; it is not derived from anything about
 * the user or the machine.
 */
export async function deviceId(
  storage: StorageArea,
  generate: () => string = () => crypto.randomUUID()
): Promise<string> {
  const stored = (await storage.get(DEVICE_ID_STORAGE_NAME))[DEVICE_ID_STORAGE_NAME]
  if (typeof stored === 'string' && DEVICE_ID.test(stored)) return stored
  const created = generate()
  await storage.set({ [DEVICE_ID_STORAGE_NAME]: created })
  return created
}
