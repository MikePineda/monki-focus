// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { packageRoot } from './PackageRoot.ts'
import { loadSchemas } from './SchemaFiles.ts'
import type { SchemaValidator } from './SchemaValidator.ts'
import { createSchemaValidator } from './SchemaValidator.ts'
import type { AliasMap } from './TargetNormaliser.ts'

let shared: SchemaValidator | undefined

/** Alias → canonical domain from the bundled site profiles (read raw: they are validated in tests). */
export function loadAliasMap(root: string = packageRoot): AliasMap {
  const aliases: Record<string, string> = {}
  const directory = join(root, 'data/sites')
  for (const fileName of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
    const profile = JSON.parse(readFileSync(join(directory, fileName), 'utf8')) as {
      domain: string
      aliases?: string[]
    }
    for (const alias of profile.aliases ?? []) aliases[alias] = profile.domain
  }
  return aliases
}

/** Validator over the package's own schemas and site-profile aliases (Node only), built once. */
export function schemaValidator(): SchemaValidator {
  shared ??= createSchemaValidator(loadSchemas(), { aliases: loadAliasMap() })
  return shared
}
