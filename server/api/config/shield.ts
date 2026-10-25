// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/shield'
import { isCsrfExempt } from '#http/csrf_exempt_routes'

const shieldConfig = defineConfig({
  /**
   * Strict CSP: same origin only, scripts with the per-request nonce, never
   * framed (`frame-ancestors 'none'`). The dashboard (S2) is built for it.
   */
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      scriptSrc: [`'self'`, '@nonce'],
      styleSrc: [`'self'`, '@nonce'],
      imgSrc: [`'self'`, 'data:'],
      fontSrc: [`'self'`],
      connectSrc: [`'self'`],
      objectSrc: [`'none'`],
      baseUri: [`'self'`],
      formAction: [`'self'`],
      frameAncestors: [`'none'`],
    },
    reportOnly: false,
  },

  /**
   * CSRF on every session route. The dashboard reads the XSRF-TOKEN cookie
   * (set on any GET) and sends it back as X-XSRF-TOKEN. Bearer device routes
   * and ntfy action URLs carry no session and are exempt
   * (app/http/csrf_exempt_routes.ts).
   */
  csrf: {
    enabled: true,
    exceptRoutes: (ctx) => isCsrfExempt(ctx.request.url()),
    enableXsrfCookie: true,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  xFrame: {
    enabled: true,
    action: 'DENY',
  },

  hsts: {
    enabled: true,
    maxAge: '180 days',
  },

  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
