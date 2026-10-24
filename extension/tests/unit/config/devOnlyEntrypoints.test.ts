// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { isEntrypointBuilt } from '../../../config/devOnlyEntrypoints'

describe('devOnlyEntrypoints', () => {
  it('dev_page_is_built_only_in_development', () => {
    expect(isEntrypointBuilt('dev', 'development')).toBe(true)
  })

  it.each(['production', 'e2e'])('dev_page_never_ships_in_%s', (mode) => {
    expect(isEntrypointBuilt('dev', mode)).toBe(false)
  })

  it.each(['popup', 'options', 'gate', 'background'])('%s_is_built_in_every_mode', (name) => {
    for (const mode of ['development', 'e2e', 'production']) {
      expect(isEntrypointBuilt(name, mode)).toBe(true)
    }
  })
})
