// SPDX-License-Identifier: AGPL-3.0-or-later
import { Exception } from '@adonisjs/core/exceptions'

/**
 * A business-rule failure on a dashboard route: an HTTP status and a stable
 * `E_*` code. The exception handler answers `{ message, code }`, the
 * message translated from `errors.<code>` (resources/lang/<locale>), so
 * the English text here is only the fallback and never reaches a log as
 * the sole explanation.
 */
export class CodedError extends Exception {
  constructor(code: string, status: number, fallbackMessage = code) {
    super(fallbackMessage, { code, status })
  }
}
