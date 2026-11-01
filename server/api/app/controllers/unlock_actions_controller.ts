// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import i18nManager from '@adonisjs/i18n/services/main'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import UnlockDecisions from '#services/unlock/unlock_decisions'
import { consumeUnlockAction } from '#services/unlock/unlock_throttles'

/**
 * `/api/v1/actions/:token`, the ntfy action buttons' capability URLs: no
 * session, no cookie, no CSRF (app/http/csrf_exempt_routes.ts).
 *
 * - `POST` decides, once. Unknown, used, expired or disabled tokens all get
 *   the same neutral 404; the token is never logged.
 * - `GET` never decides nor even looks the token up: it renders a page
 *   whose button POSTs to the same URL, so a link preview or a prefetch
 *   cannot approve anything.
 */
@inject()
export default class UnlockActionsController {
  constructor(
    protected clock: Clock,
    protected decisions: UnlockDecisions
  ) {}

  async decide(ctx: HttpContext) {
    const { params, request, response } = ctx
    await consumeUnlockAction(clientIp(ctx))
    const outcome = await this.decisions.decideFromAction(String(params.token), this.clock.now())
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')
    // The confirmation page's own form: answer a page, not JSON.
    if (request.is(['application/x-www-form-urlencoded'])) {
      response.status(outcome.ok ? 200 : 404)
      return this.page(ctx, outcome.ok ? 'done' : 'unavailable', false)
    }
    if (!outcome.ok) return response.notFound({ status: 'unavailable' })
    return { status: 'recorded' }
  }

  async confirm(ctx: HttpContext) {
    return this.page(ctx, 'explain', true)
  }

  protected page({ request, response }: HttpContext, body: string, withForm: boolean) {
    const i18n = i18nManager.locale(i18nManager.getSupportedLocaleFor(request.languages()) ?? 'en')
    const t = (key: string) => escapeHtml(i18n.t(`notifications.action_page.${key}`))
    const form = withForm
      ? `<form method="post"><button type="submit">${t('confirm')}</button></form>`
      : ''
    response.header('Cache-Control', 'no-store')
    response.header('Referrer-Policy', 'no-referrer')
    response.header('X-Robots-Tag', 'noindex')
    response.header('Content-Type', 'text/html; charset=utf-8')
    return `<!doctype html>
<html lang="${escapeHtml(i18n.locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${t('title')}</title></head>
<body>
<main>
<h1>${t('title')}</h1>
<p>${t(body)}</p>
${form}
</main>
</body>
</html>
`
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
