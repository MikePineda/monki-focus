// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

/**
 * AES-256-GCM with APP_KEY: session cookies, the XSRF cookie and, later,
 * signing keys at rest. Rotating APP_KEY invalidates sessions and needs a
 * key re-encryption step (docs/RUNBOOK.md, with the signing keys).
 */
const encryptionConfig = defineConfig({
  default: 'gcm',

  list: {
    gcm: drivers.aes256gcm({
      keys: [env.get('APP_KEY')],
      id: 'gcm',
    }),
  },
})

export default encryptionConfig

declare module '@adonisjs/core/types' {
  export interface EncryptorsList extends InferEncryptors<typeof encryptionConfig> {}
}
