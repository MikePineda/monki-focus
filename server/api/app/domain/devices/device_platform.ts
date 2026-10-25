// SPDX-License-Identifier: AGPL-3.0-or-later

/** Client platforms (openapi.yaml `Platform`), also the `X-Client-Version` prefixes. */
export const DEVICE_PLATFORMS = ['chrome_extension', 'android', 'macos', 'other'] as const

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number]
