// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'

type EnvName = Parameters<typeof env.get>[0]

/**
 * Puts an optional variable a test changed back to "not set".
 * `env.set(name, undefined)` alone is not enough: it also writes the
 * string "undefined" into `process.env`, which `env.get` then returns.
 */
export function unsetEnv(name: EnvName) {
  env.set(name, undefined as never)
  delete process.env[name]
}
