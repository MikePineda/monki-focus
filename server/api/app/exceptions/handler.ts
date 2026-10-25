// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import type { I18n } from '@adonisjs/i18n'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

/** Self-rendering framework errors whose own rendering does not fit a JSON API. */
const JSON_RENDERED_CODES = new Set(['E_BAD_CSRF_TOKEN'])

/** Postgres unique_violation: a race lost against a concurrent insert. */
const PG_UNIQUE_VIOLATION = '23505'

function hasPgCode(error: unknown, code: string): error is Error & { status?: number } {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code
}

/**
 * JSON-only error rendering:
 *
 * - Exceptions that render themselves (validation, throttle) keep their
 *   shape: 422 `{ errors: [{ field, rule, message }] }`, 429 `{ errors }`.
 *   CSRF failures answer 403 `{ message, code }` (Shield would redirect back).
 * - Any other 4xx answers `{ message, code }`, the message translated from
 *   `errors.<code>` in the request's locale. Never the debug page.
 * - Unique violations answer 409 `E_CONFLICT`, never the constraint name.
 * - 5xx: the debug page in development; in production a generic translated
 *   `{ message, code: 'E_INTERNAL_SERVER_ERROR' }`. Driver messages, table
 *   and constraint names stay in the (redacted) logs.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
  protected override debug = !app.inProduction

  override async handle(error: unknown, ctx: HttpContext) {
    const i18n = 'i18n' in ctx ? (ctx.i18n as I18n | undefined) : undefined
    const translate = (code: string, fallback: string) =>
      i18n ? i18n.t(`errors.${code}`, {}, fallback) : fallback

    if (hasPgCode(error, PG_UNIQUE_VIOLATION)) {
      error.status = 409
      return ctx.response
        .status(409)
        .send({ message: translate('E_CONFLICT', 'Conflict'), code: 'E_CONFLICT' })
    }

    const httpError = this.toHttpError(error) as {
      status: number
      code?: string
      message: string
      handle?: unknown
    }
    const selfRendered =
      typeof httpError.handle === 'function' && !JSON_RENDERED_CODES.has(httpError.code ?? '')
    const isValidation = httpError.code === 'E_VALIDATION_ERROR'

    if (!selfRendered && !isValidation && httpError.status >= 400 && httpError.status < 500) {
      const message = httpError.code
        ? translate(httpError.code, httpError.message)
        : httpError.message
      return ctx.response.status(httpError.status).send({ message, code: httpError.code })
    }

    if (httpError.status >= 500 && !this.debug) {
      return ctx.response.status(httpError.status).send({
        message: translate('E_INTERNAL_SERVER_ERROR', 'Internal server error'),
        code: 'E_INTERNAL_SERVER_ERROR',
      })
    }

    return super.handle(error, ctx)
  }
}
