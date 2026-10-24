// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The bundled data files as imported JSON (no file system), for browsers and
 * service workers. They are not re-validated at import: tests prove they equal
 * the schema-validated files the Node readers in `RulesData.ts` return.
 */
import defaultCategoriesJson from '../data/categories/default.json' with { type: 'json' }
import starterPresetJson from '../data/presets/starter.ruleset.json' with { type: 'json' }
import instagram from '../data/sites/instagram.com.json' with { type: 'json' }
import reddit from '../data/sites/reddit.com.json' with { type: 'json' }
import x from '../data/sites/x.com.json' with { type: 'json' }
import youtube from '../data/sites/youtube.com.json' with { type: 'json' }
import surfaceRegistryJson from '../data/surfaces.json' with { type: 'json' }
import type {
  CategoryCatalog,
  Ruleset,
  SiteProfile,
  SurfaceRegistry,
} from './generated/SchemaTypes.ts'

export const surfaceRegistry = surfaceRegistryJson as SurfaceRegistry

/** Every `data/sites/*.json` profile, ordered by file name. */
export const siteProfiles: readonly SiteProfile[] = [
  instagram as SiteProfile,
  reddit as SiteProfile,
  x as SiteProfile,
  youtube as SiteProfile,
]

export const defaultCategories = defaultCategoriesJson as CategoryCatalog

export const starterPreset = starterPresetJson as Ruleset
