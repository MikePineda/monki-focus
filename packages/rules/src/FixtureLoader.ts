// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FixtureByKind } from './Fixture.ts'
import { listFixtureFiles } from './FixtureFiles.ts'
import { assertLoadableFixtureKind } from './FixtureKind.ts'
import type { LoadableFixtureKind } from './FixtureKind.ts'
import { loadSchemas } from './SchemaFiles.ts'
import { createSchemaValidator } from './SchemaValidator.ts'
import { loadAliasMap, schemaValidator } from './PackageSchemaValidator.ts'
import { packageRoot } from './PackageRoot.ts'

export interface LoadFixturesOptions {
  /** Package root to read `schema/` and `fixtures/` from (tests point it at a copy). */
  root?: string
}

/**
 * Loads, validates and returns every fixture of `kind`, sorted by id, for
 * `describe.each(loadFixtures('decision'))`. Throws on an unknown kind, on a
 * file that fails its schema, and on a fixture filed under the wrong kind.
 */
export function loadFixtures<K extends LoadableFixtureKind>(
  kind: K,
  options: LoadFixturesOptions = {}
): FixtureByKind[K][] {
  assertLoadableFixtureKind(kind)
  const root = options.root ?? packageRoot
  const validator =
    root === packageRoot
      ? schemaValidator()
      : createSchemaValidator(loadSchemas(root), { aliases: loadAliasMap() })
  const fixtures = listFixtureFiles(root, [kind]).map((file) => {
    const result = validator.validateDocument('fixture', file.text)
    if (!result.valid) {
      throw new Error(`${file.relativePath} is not a valid fixture: ${result.errors.join('; ')}`)
    }
    const fixture = file.json as FixtureByKind[K]
    if (fixture.kind !== kind) {
      throw new Error(
        `${file.relativePath} has kind ${fixture.kind} but sits in the ${kind} directory`
      )
    }
    const expectedName = `${fixture.id.slice(fixture.id.indexOf('.') + 1)}.json`
    if (file.fileName !== expectedName) {
      throw new Error(`${file.relativePath} must be named ${expectedName} after its id`)
    }
    return fixture
  })
  return fixtures.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
