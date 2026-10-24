// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { extensionManifest, SITE_HOST_PERMISSIONS } from '../../../config/extensionManifest'

const DEV_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsynthetic'

describe('extensionManifest', () => {
  it('production_manifest_never_carries_a_key', () => {
    expect(extensionManifest({ mode: 'production', devPublicKey: DEV_KEY })).not.toHaveProperty(
      'key'
    )
  })

  it.each(['development', 'e2e'])('%s_manifest_pins_the_id_with_the_dev_public_key', (mode) => {
    expect(extensionManifest({ mode, devPublicKey: DEV_KEY }).key).toBe(DEV_KEY)
  })

  it('manifest_without_dev_public_key_has_no_key', () => {
    expect(extensionManifest({ mode: 'e2e', devPublicKey: '  ' })).not.toHaveProperty('key')
    expect(extensionManifest({ mode: 'development' })).not.toHaveProperty('key')
  })

  it('host_permissions_cover_only_the_built_in_sites', () => {
    const manifest = extensionManifest({ mode: 'production' })
    expect(manifest.host_permissions).toEqual([...SITE_HOST_PERMISSIONS])
    expect(manifest.optional_host_permissions).toEqual(['<all_urls>'])
  })

  it('manifest_exposes_no_external_messaging_surface', () => {
    const manifest = extensionManifest({ mode: 'production' })
    expect(manifest).not.toHaveProperty('externally_connectable')
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ['gate.html'], matches: ['<all_urls>'], use_dynamic_url: true },
    ])
  })

  it('manifest_spans_incognito_and_is_localised', () => {
    const manifest = extensionManifest({ mode: 'production' })
    expect(manifest.incognito).toBe('spanning')
    expect(manifest.name).toBe('__MSG_extName__')
    expect(manifest.default_locale).toBe('en')
  })
})
