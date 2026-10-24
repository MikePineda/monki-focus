// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFixtures } from '../../src/index.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

const scratchRoots: string[] = []

/** A throwaway copy of the package's schema + fixtures so a test can plant a bad file. */
function scratchPackage(): string {
  const root = mkdtempSync(join(tmpdir(), 'monki-rules-'))
  scratchRoots.push(root)
  cpSync(join(packageRoot, 'schema'), join(root, 'schema'), { recursive: true })
  cpSync(join(packageRoot, 'fixtures'), join(root, 'fixtures'), { recursive: true })
  return root
}

afterEach(() => {
  for (const root of scratchRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('loadFixtures', () => {
  it('loads_every_fixture_of_a_kind_sorted_by_id', () => {
    const fixtures = loadFixtures('url-normalize')
    expect(fixtures.length).toBeGreaterThanOrEqual(6)
    const ids = fixtures.map((fixture) => fixture.id)
    expect(ids).toEqual([...ids].sort())
    for (const fixture of fixtures) expect(fixture.kind).toBe('url-normalize')
  })

  it('returns_typed_fixtures', () => {
    const [first] = loadFixtures('decision')
    expect(first?.then.access).toMatch(/^(allow|gate|block)$/)
  })

  it('throws_for_an_unknown_kind', () => {
    expect(() => loadFixtures('detector-xml' as never)).toThrow(/unknown fixture kind/i)
  })

  it('throws_for_unlock_token_and_points_to_protocol', () => {
    expect(() => loadFixtures('unlock-token' as never)).toThrow(/packages\/protocol/)
  })

  it('rejects_a_fixture_that_fails_its_schema', () => {
    const root = scratchPackage()
    writeFileSync(
      join(root, 'fixtures/url-normalize/broken.json'),
      JSON.stringify({ id: 'url-normalize.broken', kind: 'url-normalize', description: 'x' })
    )
    expect(() => loadFixtures('url-normalize', { root })).toThrow(/broken\.json/)
  })

  it('rejects_a_fixture_in_the_wrong_directory', () => {
    const root = scratchPackage()
    const misplaced = loadFixtures('url-normalize')[0]
    writeFileSync(
      join(root, 'fixtures/schedule', `${misplaced?.id.split('.')[1] ?? 'x'}.json`),
      JSON.stringify(misplaced)
    )
    expect(() => loadFixtures('schedule', { root })).toThrow(/directory/)
  })

  it('rejects_a_non_json_file_in_a_fixture_directory', () => {
    const root = scratchPackage()
    writeFileSync(join(root, 'fixtures/schedule/notes.txt'), 'stray file')
    expect(() => loadFixtures('schedule', { root })).toThrow(/notes\.txt/)
  })
})
