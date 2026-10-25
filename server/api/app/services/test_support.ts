// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { isJapaProcess } from '#services/japa_process'
import { isLoopbackHost, isLoopbackUrl } from '#http/loopback_address'

export interface TestSupportInput {
  /** Set only by the Japa entrypoint (app/services/japa_process.ts). */
  japaProcess: boolean
  e2eMode: boolean
  host: string
  appUrl: string
}

/**
 * Test-support routes (`/api/test/*`: scheduler tick, later the fake clock)
 * exist only inside the Japa process or with E2E_MODE, and in both cases
 * only when the server listens on and is addressed through loopback.
 * NODE_ENV never opens them. start/env_schema.ts refuses to boot with the
 * same flags on a non-loopback HOST or APP_URL.
 */
export function testSupportAllowed(input: TestSupportInput): boolean {
  return (
    (input.japaProcess || input.e2eMode) &&
    isLoopbackHost(input.host) &&
    isLoopbackUrl(input.appUrl)
  )
}

export function testSupportEnabled(): boolean {
  return testSupportAllowed({
    japaProcess: isJapaProcess(),
    e2eMode: env.get('E2E_MODE') === true,
    host: env.get('HOST'),
    appUrl: env.get('APP_URL'),
  })
}
