// SPDX-License-Identifier: AGPL-3.0-or-later
import { surfaceRegistry } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import en from '../../../src/i18n/catalogs/en.json'
import { createTranslator } from '../../../src/i18n/t'
import { daysLabel, scheduleSummary, surfaceNameKey } from '../../../src/options/rules/RuleText'
import { pulseBand } from '../../../src/options/stats/WeekViewModel'

const t = createTranslator('en')

describe('RuleText', () => {
  it('every_bundled_surface_has_a_name_in_the_catalogs', () => {
    const missing = surfaceRegistry.surfaces
      .map((surface) => surfaceNameKey(surface.id))
      .filter((key) => !Object.hasOwn(en, key))

    expect(missing).toEqual([])
  })

  it('summarises_schedules_in_words', () => {
    expect(scheduleSummary([], t, 'en')).toBe('Always')
    expect(scheduleSummary([{ ref: 'workHours' }], t, 'en')).toBe('Work hours')
    expect(
      scheduleSummary(
        [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:30' }],
        t,
        'en'
      )
    ).toBe('Mon–Fri 9:00 AM–5:30 PM')
    expect(
      scheduleSummary(
        [{ days: ['sat', 'sun'], start: '22:30', end: '07:00' }],
        createTranslator('es'),
        'es'
      )
    ).toBe('Sáb, Dom 22:30–7:00')
  })

  it('names_whole_weeks_and_runs_of_days', () => {
    expect(daysLabel(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], t)).toBe('Every day')
    expect(daysLabel(['mon', 'wed'], t)).toBe('Mon, Wed')
  })
})

describe('pulseBand', () => {
  it.each([
    [null, null],
    [0, 0],
    [19, 0],
    [20, 1],
    [59, 2],
    [79, 3],
    [80, 4],
    [100, 4],
  ])('pulse_%s_falls_in_band_%s', (pulse, band) => {
    expect(pulseBand(pulse)).toBe(band)
  })
})
