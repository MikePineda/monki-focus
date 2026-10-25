// SPDX-License-Identifier: AGPL-3.0-or-later
import { Exception } from '@adonisjs/core/exceptions'

/**
 * A business-rule failure on a device route: an HTTP status and a stable
 * snake_case reason code, answered as the contract's `Error`
 * (`{ code, fields? }`, packages/protocol/openapi.yaml). No text: clients
 * map codes to their own catalogs.
 */
export class DeviceApiError extends Exception {
  constructor(
    code: string,
    status: number,
    readonly fields?: Readonly<Record<string, string>>
  ) {
    super(code, { code, status })
  }
}
