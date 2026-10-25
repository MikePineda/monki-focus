// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Passwords are hashed with scrypt (Node's crypto.scrypt, the AdonisJS
 * default: no native addon in the image). OWASP's lower-memory equivalent
 * of N=2^17/p=1: 64 MiB of native memory per hash (outside the V8 heap),
 * so maxMemory must stay above 128 * N * r. Logins are throttled, which
 * also bounds concurrent hashes. Hashes carry their own parameters:
 * changing these never breaks old ones.
 */
export const PRODUCTION_SCRYPT = {
  cost: 2 ** 16,
  blockSize: 8,
  parallelization: 2,
  maxMemory: 256 * 1024 * 1024,
}

/** Cheap parameters for the test suite only (NODE_ENV=test). */
export const TEST_SCRYPT = {
  cost: 2 ** 10,
  blockSize: 8,
  parallelization: 1,
  maxMemory: 32 * 1024 * 1024,
}

const hashConfig = defineConfig({
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt(app.inTest ? TEST_SCRYPT : PRODUCTION_SCRYPT),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
