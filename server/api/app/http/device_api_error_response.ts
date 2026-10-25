// SPDX-License-Identifier: AGPL-3.0-or-later

/** Paths answered in the device API's error format (packages/protocol/openapi.yaml `Error`). */
const DEVICE_API_PREFIX = '/api/v1/device/'

export function isDeviceApiPath(url: string): boolean {
  return url.split('?')[0].startsWith(DEVICE_API_PREFIX)
}

export interface DeviceApiErrorResponse {
  readonly status: number
  readonly body: { code: string; fields?: Record<string, string> }
  readonly headers: Record<string, string>
}

interface ErrorLike {
  status?: unknown
  code?: unknown
  fields?: unknown
  messages?: unknown
  response?: { availableIn?: unknown }
}

/** Framework codes with a fixed device-API answer. */
const KNOWN: Record<string, { status: number; code: string }> = {
  E_UNAUTHORIZED_ACCESS: { status: 401, code: 'unauthorized' },
  E_ROW_NOT_FOUND: { status: 404, code: 'not_found' },
  E_ROUTE_NOT_FOUND: { status: 404, code: 'not_found' },
  E_TOO_MANY_REQUESTS: { status: 429, code: 'too_many_requests' },
}

/**
 * The device API never answers the dashboard's `{ message, code: 'E_*' }`
 * (translated text) or a framework page: always `{ code, fields? }` with
 * a snake_case reason code.
 *
 * - validation: 422 `{ code: 'validation_failed', fields: { <path>: <rule> } }`
 * - auth: 401 `unauthorized`; a missing row or route: 404 `not_found`
 * - throttles: 429 `too_many_requests` with `Retry-After`
 * - a lost race on a unique key: 409 `conflict`
 * - `DeviceApiError`: its own code, status and fields
 * - any other 4xx: the framework code without `E_`, lowercased
 * - 5xx: `internal_error` (details stay in the redacted logs)
 */
export function deviceApiErrorResponse(
  error: unknown,
  uniqueViolation: boolean
): DeviceApiErrorResponse {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const frameworkCode = typeof candidate.code === 'string' ? candidate.code : ''

  if (uniqueViolation) return { status: 409, body: { code: 'conflict' }, headers: {} }

  if (frameworkCode === 'E_VALIDATION_ERROR' && Array.isArray(candidate.messages)) {
    const fields: Record<string, string> = {}
    for (const entry of candidate.messages as Array<{ field?: unknown; rule?: unknown }>) {
      const field = typeof entry.field === 'string' && entry.field !== '' ? entry.field : '$'
      if (!(field in fields))
        fields[field] = typeof entry.rule === 'string' ? entry.rule : 'invalid'
    }
    return { status: 422, body: { code: 'validation_failed', fields }, headers: {} }
  }

  const known = KNOWN[frameworkCode]
  if (known) {
    const headers: Record<string, string> = {}
    const retryAfter = candidate.response?.availableIn
    if (known.status === 429 && typeof retryAfter === 'number') {
      headers['Retry-After'] = String(Math.max(1, Math.ceil(retryAfter)))
    }
    return { status: known.status, body: { code: known.code }, headers }
  }

  const status = typeof candidate.status === 'number' ? candidate.status : 500
  if (status >= 500) return { status, body: { code: 'internal_error' }, headers: {} }

  if (frameworkCode !== '' && !frameworkCode.startsWith('E_')) {
    const fields = isFieldMap(candidate.fields) ? { fields: { ...candidate.fields } } : {}
    return { status, body: { code: frameworkCode, ...fields }, headers: {} }
  }
  const code = frameworkCode === '' ? 'bad_request' : frameworkCode.slice(2).toLowerCase()
  return { status, body: { code }, headers: {} }
}

function isFieldMap(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}
