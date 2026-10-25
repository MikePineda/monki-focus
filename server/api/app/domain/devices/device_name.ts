// SPDX-License-Identifier: AGPL-3.0-or-later

/** Device names ("Work laptop"): shown to the user and the guardian. */
export const DEVICE_NAME_MAX_LENGTH = 64

/** C0 and C1 controls, DEL and the Unicode line and paragraph separators. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]')

/** 1-64 characters after trimming, no control or line-separator characters. */
export function isDeviceName(value: string): boolean {
  return (
    value.length >= 1 && value.length <= DEVICE_NAME_MAX_LENGTH && !CONTROL_CHARACTERS.test(value)
  )
}
