// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Most devices one user may have enrolled at once (revoked ones do not
 * count): enough for every browser and phone of a person, small enough that
 * a stolen session cannot mint devices without end.
 */
export const MAX_ACTIVE_DEVICES = 20

export function hasRoomForAnotherDevice(activeDevices: number): boolean {
  return activeDevices < MAX_ACTIVE_DEVICES
}
