// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Typed, validated readers for the bundled data files (Node only). Engines
 * need the surface registry, the site profiles and the default categories.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CategoryCatalog,
  Ruleset,
  SiteProfile,
  SurfaceRegistry,
} from './generated/SchemaTypes.ts'
import { schemaValidator } from './PackageSchemaValidator.ts'
import { packageRoot } from './PackageRoot.ts'
import type { SchemaName } from './SchemaName.ts'

function readValidated(relativePath: string, schema: SchemaName): unknown {
  const text = readFileSync(join(packageRoot, relativePath), 'utf8')
  const result = schemaValidator().validateDocument(schema, text)
  if (!result.valid) {
    throw new Error(`${relativePath} does not match ${schema}: ${result.errors.join('; ')}`)
  }
  return JSON.parse(text)
}

export function loadSurfaceRegistry(): SurfaceRegistry {
  return readValidated('data/surfaces.json', 'surface-registry') as SurfaceRegistry
}

export interface SiteProfileFile {
  fileName: string
  profile: SiteProfile
}

export function loadSiteProfiles(): SiteProfileFile[] {
  return readdirSync(join(packageRoot, 'data/sites'))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      profile: readValidated(`data/sites/${fileName}`, 'site-profile') as SiteProfile,
    }))
}

export function loadDefaultCategories(): CategoryCatalog {
  return readValidated('data/categories/default.json', 'category-catalog') as CategoryCatalog
}

export function loadStarterPreset(): Ruleset {
  return readValidated('data/presets/starter.ruleset.json', 'ruleset') as Ruleset
}
