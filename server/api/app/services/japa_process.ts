// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * An in-process marker set only by the Japa entrypoint (bin/test.ts), so
 * NODE_ENV=test alone (a misconfigured deployment) never opens the
 * test-support routes. A global symbol, so a second copy of this module
 * still sees it.
 */
const JAPA_PROCESS = Symbol.for('monki-focus.japa-process')

type Marked = typeof globalThis & { [JAPA_PROCESS]?: boolean }

export function markJapaProcess(): void {
  ;(globalThis as Marked)[JAPA_PROCESS] = true
}

export function isJapaProcess(): boolean {
  return (globalThis as Marked)[JAPA_PROCESS] === true
}
