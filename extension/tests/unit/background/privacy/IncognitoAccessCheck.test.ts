// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { IncognitoAccessCheck } from '../../../../src/background/privacy/IncognitoAccessCheck'

describe('IncognitoAccessCheck', () => {
  it.each([true, false])('reports_incognito_access_allowed_%s', async (allowed) => {
    const check = new IncognitoAccessCheck({ isAllowedIncognitoAccess: async () => allowed })

    expect(await check.check()).toEqual({ allowed })
  })
})
