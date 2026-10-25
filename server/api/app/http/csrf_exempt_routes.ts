// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Route prefixes that never carry a session, so CSRF does not apply:
 *
 * - `/api/v1/device/`: native clients and the extension, Bearer device tokens.
 * - `/api/v1/actions/`: ntfy action buttons (single-use capability URLs, POST).
 *
 * Everything else (dashboard routes, test support) needs the XSRF token on
 * POST, PUT, PATCH and DELETE.
 */
const SESSIONLESS_PREFIXES = ['/api/v1/device/', '/api/v1/actions/']

export function isCsrfExempt(url: string): boolean {
  const path = url.split('?')[0]
  return SESSIONLESS_PREFIXES.some((prefix) => path.startsWith(prefix))
}
