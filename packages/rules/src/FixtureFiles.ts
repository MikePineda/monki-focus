// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NON_KIND_FIXTURE_DIRECTORIES } from './FixtureKind.ts'
import { packageRoot } from './PackageRoot.ts'

export interface FixtureFile {
  /** Absolute path. */
  path: string
  /** Path relative to the package root, with `/` separators. */
  relativePath: string
  /** The kind directory the file sits in (`fixtures/<directory>/`). */
  directory: string
  fileName: string
  text: string
  json: unknown
}

/** Files every runner must ignore: documentation only. */
const DOCUMENTATION_FILES = new Set(['README.md'])

/**
 * Every JSON file under `fixtures/<kind>/`, sorted by path (the UI dump
 * directories of `NON_KIND_FIXTURE_DIRECTORIES` are not kinds and are skipped). A file that is
 * not JSON (other than a README) or does not parse throws: nothing is skipped
 * silently.
 */
export function listFixtureFiles(
  root: string = packageRoot,
  directories?: readonly string[]
): FixtureFile[] {
  const fixturesRoot = join(root, 'fixtures')
  const skipped = new Set<string>(NON_KIND_FIXTURE_DIRECTORIES)
  const kinds =
    directories ??
    readdirSync(fixturesRoot)
      .filter((name) => !skipped.has(name))
      .sort()
  return kinds.flatMap((directory) => {
    const absolute = join(fixturesRoot, directory)
    if (!statSync(absolute).isDirectory()) {
      throw new Error(`fixtures/${directory} is not a directory`)
    }
    return readdirSync(absolute)
      .filter((fileName) => !DOCUMENTATION_FILES.has(fileName))
      .sort()
      .map((fileName) => {
        const relativePath = `fixtures/${directory}/${fileName}`
        if (!fileName.endsWith('.json'))
          throw new Error(`${relativePath}: fixtures must be .json files`)
        const path = join(absolute, fileName)
        const text = readFileSync(path, 'utf8')
        let json: unknown
        try {
          json = JSON.parse(text)
        } catch (error) {
          throw new Error(`${relativePath}: invalid JSON`, { cause: error })
        }
        return { path, relativePath, directory, fileName, text, json }
      })
  })
}
