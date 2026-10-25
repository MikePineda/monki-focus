// SPDX-License-Identifier: AGPL-3.0-or-later
import { I18n } from '@adonisjs/i18n'
import i18nManager from '@adonisjs/i18n/services/main'
import type { NextFn } from '@adonisjs/core/types/http'
import { type HttpContext, RequestValidator } from '@adonisjs/core/http'

/**
 * Shares a request-scoped `ctx.i18n`. A server middleware (runs before
 * routing), so even a 404 for an unknown route is translated. Today the
 * locale comes from Accept-Language, then APP_DEFAULT_LOCALE; the user's own
 * preference joins in front of both once accounts exist (S2).
 */
export default class DetectLocaleMiddleware {
  /** VineJS messages come from resources/lang/<locale>/validator.json. */
  static {
    RequestValidator.messagesProvider = (ctx) => ctx.i18n.createMessagesProvider()
  }

  handle(ctx: HttpContext, next: NextFn) {
    const locale =
      i18nManager.getSupportedLocaleFor(ctx.request.languages()) ?? i18nManager.defaultLocale

    ctx.i18n = i18nManager.locale(locale)
    ctx.containerResolver.bindValue(I18n, ctx.i18n)
    ctx.response.header('Content-Language', locale)

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    i18n: I18n
  }
}
