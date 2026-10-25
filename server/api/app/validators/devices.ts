// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'
import { DEVICE_NAME_MAX_LENGTH, isDeviceName } from '#domain/devices/device_name'
import { DEADMAN_HOURS_MAX, DEADMAN_HOURS_MIN } from '#domain/devices/deadman_rule'

const plainName = vine.createRule((value: unknown, _: undefined, field: FieldContext) => {
  if (typeof value === 'string' && !isDeviceName(value)) {
    field.report('The {{ field }} field has the wrong format', 'regex', field)
  }
})

/** A device name, trimmed: 1-64 characters, no control characters. */
export function deviceName() {
  return vine.string().trim().minLength(1).maxLength(DEVICE_NAME_MAX_LENGTH).use(plainName())
}

/** PATCH /devices/:uuid. Both optional; unknown fields ignored. */
export const updateDeviceValidator = vine.create({
  name: deviceName().optional(),
  deadmanHours: vine
    .number({ strict: true })
    .withoutDecimals()
    .min(DEADMAN_HOURS_MIN)
    .max(DEADMAN_HOURS_MAX)
    .optional(),
})
