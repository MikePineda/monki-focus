// SPDX-License-Identifier: AGPL-3.0-or-later
import { I18n } from '@adonisjs/i18n'
import i18nManager from '@adonisjs/i18n/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Runs after `auth` on dashboard routes: the signed-in user's own language
 * replaces the Accept-Language guess of the detect-locale middleware, for
 * messages, validation errors and Content-Language.
 */
export default class UserLocaleMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.authenticatedViaGuard === 'web' ? ctx.auth.use('web').user : undefined
    if (user && i18nManager.supportedLocales().includes(user.locale)) {
      ctx.i18n = i18nManager.locale(user.locale)
      ctx.containerResolver.bindValue(I18n, ctx.i18n)
      ctx.response.header('Content-Language', user.locale)
    }
    return next()
  }
}
