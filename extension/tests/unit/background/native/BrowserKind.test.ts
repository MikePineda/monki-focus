// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { browserKind } from '../../../../src/background/native/BrowserKind'
import { extensionVersion } from '../../../../src/background/native/ExtensionVersion'

describe('browser kind and extension version', () => {
  it('brave_is_told_apart_by_navigator_brave', () => {
    expect(
      browserKind({ brave: {}, userAgentData: { brands: [{ brand: 'Google Chrome' }] } })
    ).toBe('brave')
  })

  it('chrome_names_itself_in_the_brands', () => {
    expect(browserKind({ userAgentData: { brands: [{ brand: 'Google Chrome' }] } })).toBe('chrome')
    expect(browserKind({ userAgentData: { brands: [{ brand: 'Chromium' }] } })).toBe('other')
    expect(browserKind({})).toBe('other')
  })

  it('the_version_falls_back_when_the_manifest_cannot_be_read', () => {
    expect(extensionVersion({ getManifest: () => ({ version: '1.2.3' }) })).toBe('1.2.3')
    expect(
      extensionVersion({
        getManifest: () => {
          throw new Error('not available')
        },
      })
    ).toBe('0.0.0')
  })
})
