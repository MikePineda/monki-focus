// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { schemaValidator } from '../../src/index.ts'

/** A synthetic pack with the real structure (no packs ship before the Android work package). */
function pack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    packId: 'instagram',
    packVersion: '2026.10.25.1',
    minSchemaVersion: 1,
    packages: ['com.instagram.android'],
    testedAppVersions: ['400.0.0.0.0'],
    unclassifiedCapMinutes: 0,
    keepVisible: ['action_bar', 'tab_bar'],
    surfaces: [
      {
        surface: 'instagram.reels',
        priority: 90,
        all: [{ viewId: 'clips_viewer_view_pager', onScreen: true, minHeightRatio: 0.8 }],
        any: [{ viewId: 'clips_ufi_component' }, { viewId: 'clips_video_container' }],
      },
    ],
    ...overrides,
  }
}

function isValidPack(value: unknown): boolean {
  return schemaValidator().validate('detector-pack', value).valid
}

describe('detector pack schema', () => {
  it('accepts_a_data_only_pack', () => {
    expect(isValidPack(pack())).toBe(true)
  })

  it('rejects_an_empty_all_or_any_list', () => {
    const surface = { surface: 'instagram.reels', priority: 90, all: [] }
    expect(isValidPack(pack({ surfaces: [surface] }))).toBe(false)
    const anySurface = { surface: 'instagram.reels', priority: 90, any: [] }
    expect(isValidPack(pack({ surfaces: [anySurface] }))).toBe(false)
  })

  it('predicate_needs_a_view_id_text_or_content_description', () => {
    const surface = { surface: 'instagram.reels', priority: 90, all: [{ onScreen: true }] }
    expect(isValidPack(pack({ surfaces: [surface] }))).toBe(false)
    const byText = { surface: 'instagram.reels', priority: 90, all: [{ text: 'Reels' }] }
    expect(isValidPack(pack({ surfaces: [byText] }))).toBe(true)
  })

  it('pack_version_is_calver', () => {
    expect(isValidPack(pack({ packVersion: '1.2.3' }))).toBe(false)
  })

  it('pack_version_names_a_month_and_day_and_a_serial_without_leading_zeros', () => {
    for (const version of [
      '2026.13.01.1',
      '2026.00.10.1',
      '2026.10.32.1',
      '2026.10.00.1',
      '2026.10.25.01',
    ]) {
      expect(isValidPack(pack({ packVersion: version })), version).toBe(false)
    }
    for (const version of ['2026.12.31.0', '2026.01.01.999']) {
      expect(isValidPack(pack({ packVersion: version })), version).toBe(true)
    }
  })

  it('min_schema_version_is_bounded', () => {
    expect(isValidPack(pack({ minSchemaVersion: 100 }))).toBe(false)
  })

  it('predicates_take_no_regex_or_script', () => {
    const surface = {
      surface: 'instagram.reels',
      priority: 90,
      all: [{ viewId: 'clips_viewer_view_pager', script: 'return true' }],
    }
    expect(isValidPack(pack({ surfaces: [surface] }))).toBe(false)
  })
})
