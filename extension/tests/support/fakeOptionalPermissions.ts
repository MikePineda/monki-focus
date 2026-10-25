// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from 'vitest'

/** `browser.permissions` for API permissions, granting whatever is requested. */
export function fakeOptionalPermissions(granted: readonly string[] = []) {
  const permissions = new Set(granted)
  return {
    contains: vi.fn(({ permissions: asked }: { permissions: string[] }) =>
      Promise.resolve(asked.every((name) => permissions.has(name)))
    ),
    request: vi.fn(({ permissions: asked }: { permissions: string[] }) => {
      for (const name of asked) permissions.add(name)
      return Promise.resolve(true)
    }),
    remove: vi.fn(({ permissions: asked }: { permissions: string[] }) => {
      for (const name of asked) permissions.delete(name)
      return Promise.resolve(true)
    }),
  }
}
