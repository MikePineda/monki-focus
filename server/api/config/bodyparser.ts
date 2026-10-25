// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@adonisjs/core/bodyparser'

/**
 * JSON API: small JSON bodies only. No multipart (the server never stores
 * files: the container is stateless). The largest planned body is an
 * activity batch (at most 2000 five-minute blocks).
 */
const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
  },

  json: {
    convertEmptyStringsToNull: true,
    limit: '1mb',
    types: ['application/json', 'application/csp-report'],
  },

  multipart: {
    autoProcess: false,
    convertEmptyStringsToNull: true,
    limit: '1mb',
    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig
