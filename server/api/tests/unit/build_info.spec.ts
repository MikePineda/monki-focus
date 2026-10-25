// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from '@japa/runner'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readBuildInfo } from '#services/build_info'

test.group('Build info', (group) => {
  let dir: string

  group.each.setup(async () => {
    dir = await mkdtemp(join(tmpdir(), 'monki-focus-build-info-'))
    return () => rm(dir, { recursive: true, force: true })
  })

  const sources = (overrides: { versionFromEnv?: string; shaFromEnv?: string } = {}) => ({
    versionFile: join(dir, '.app-version'),
    shaFile: join(dir, '.git-sha'),
    ...overrides,
  })

  test('test_reads_version_and_sha_baked_into_the_image', async ({ assert }) => {
    await writeFile(join(dir, '.app-version'), '0.4.2\n')
    await writeFile(join(dir, '.git-sha'), 'a1b2c3d4e5f6\n')

    assert.deepEqual(await readBuildInfo(sources()), { version: '0.4.2', sha: 'a1b2c3d4e5f6' })
  })

  test('test_non_blank_environment_values_win_over_the_files', async ({ assert }) => {
    await writeFile(join(dir, '.app-version'), '0.4.2')
    await writeFile(join(dir, '.git-sha'), 'a1b2c3d4e5f6')

    const info = await readBuildInfo(sources({ versionFromEnv: '9.9.9', shaFromEnv: 'feedface' }))

    assert.deepEqual(info, { version: '9.9.9', sha: 'feedface' })
  })

  test('test_blank_environment_values_are_ignored', async ({ assert }) => {
    await writeFile(join(dir, '.app-version'), '0.4.2')

    const info = await readBuildInfo(sources({ versionFromEnv: '  ', shaFromEnv: '' }))

    assert.equal(info.version, '0.4.2')
  })

  test('test_falls_back_to_dev_and_unknown', async ({ assert }) => {
    assert.deepEqual(await readBuildInfo(sources()), { version: 'dev', sha: 'unknown' })
  })

  test('test_empty_files_count_as_missing', async ({ assert }) => {
    await writeFile(join(dir, '.app-version'), '')
    await writeFile(join(dir, '.git-sha'), '\n')

    assert.deepEqual(await readBuildInfo(sources()), { version: 'dev', sha: 'unknown' })
  })
})
