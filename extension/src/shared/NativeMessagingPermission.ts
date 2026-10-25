// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The optional permission the bridge to the macOS app needs. The options
 * page asks for it from an explicit "Connect the Mac app" control (a user
 * gesture); the service worker starts the bridge only once it is granted.
 */
export const NATIVE_MESSAGING_PERMISSION = 'nativeMessaging' as const

/** The permission set the bridge asks about. */
export interface NativeMessagingPermissions {
  permissions: (typeof NATIVE_MESSAGING_PERMISSION)[]
}

/** The slice of `browser.permissions` for the bridge's API permission (not origins). */
export interface OptionalPermissionsApi {
  contains(permissions: NativeMessagingPermissions): Promise<boolean>
  request(permissions: NativeMessagingPermissions): Promise<boolean>
  remove(permissions: NativeMessagingPermissions): Promise<boolean>
}
