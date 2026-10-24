// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { packageRoot } from './PackageRoot.ts'
import type { SchemaName } from './SchemaName.ts'

export interface DataFile {
  /** Absolute path. */
  path: string
  /** Path relative to the package root, with `/` separators. */
  relativePath: string
  schema: SchemaName
}

function jsonFilesIn(
  root: string,
  directory: string,
  suffix: string,
  schema: SchemaName
): DataFile[] {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute)
    .filter((fileName) => fileName.endsWith(suffix))
    .sort()
    .map((fileName) => ({
      path: join(absolute, fileName),
      relativePath: `${directory}/${fileName}`,
      schema,
    }))
}

/** Every bundled data file and the schema it must satisfy. */
export function listDataFiles(root: string = packageRoot): DataFile[] {
  return [
    {
      path: join(root, 'data/surfaces.json'),
      relativePath: 'data/surfaces.json',
      schema: 'surface-registry',
    },
    ...jsonFilesIn(root, 'data/sites', '.json', 'site-profile'),
    ...jsonFilesIn(root, 'data/categories', '.json', 'category-catalog'),
    ...jsonFilesIn(root, 'data/presets', '.ruleset.json', 'ruleset'),
    ...jsonFilesIn(root, 'detectors/android', '.pack.json', 'detector-pack'),
  ]
}
