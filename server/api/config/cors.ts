// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/cors'

/**
 * CORS is off in every environment: the dashboard is served from the same
 * origin, and the extension asks for the server origin as an optional host
 * permission at run time (no CORS needed for extension requests). Same
 * origin also keeps the session cookie SameSite=Lax.
 */
const corsConfig = defineConfig({
  enabled: false,
  origin: [],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: false,
  maxAge: 90,
})

export default corsConfig
