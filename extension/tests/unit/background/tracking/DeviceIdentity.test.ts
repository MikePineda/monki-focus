// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  DEVICE_ID_STORAGE_NAME,
  deviceId,
} from '../../../../src/background/tracking/DeviceIdentity'

describe('device identity', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('a_random_device_id_is_created_once_and_then_reused', async () => {
    const first = await deviceId(fakeBrowser.storage.local)
    const second = await deviceId(fakeBrowser.storage.local, () => 'never-used')

    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toBe(first)
  })

  it('an_invalid_stored_id_is_replaced', async () => {
    await fakeBrowser.storage.local.set({ [DEVICE_ID_STORAGE_NAME]: 'not a valid id!' })

    expect(await deviceId(fakeBrowser.storage.local, () => 'device-b')).toBe('device-b')
  })
})
