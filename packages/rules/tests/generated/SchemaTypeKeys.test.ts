// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, expectTypeOf, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import type { CategoryCatalog } from '../../src/index.ts'
import { loadSchemas } from '../../src/index.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

interface TitledObject {
  where: string
  title: string
  properties: string[]
}

/** Every object schema with a `title` and `properties`, anywhere in a schema document. */
function titledObjectsIn(node: unknown, where: string, found: TitledObject[]): TitledObject[] {
  if (Array.isArray(node)) {
    node.forEach((child, index) => titledObjectsIn(child, `${where}/${String(index)}`, found))
  } else if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>
    const properties = record.properties
    if (typeof record.title === 'string' && properties !== null && typeof properties === 'object') {
      found.push({ where, title: record.title, properties: Object.keys(properties).sort() })
    }
    for (const [key, child] of Object.entries(record))
      titledObjectsIn(child, `${where}/${key}`, found)
  }
  return found
}

/** Member names of a type literal; an index signature shows up as `[index]`. */
function membersOf(members: ts.NodeArray<ts.TypeElement>): string[] {
  return members.flatMap((member) => {
    if (ts.isIndexSignatureDeclaration(member)) return ['[index]']
    const name = member.name
    return name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name))
      ? [name.text]
      : []
  })
}

/** Object members of a type alias: a type literal or an intersection of them. */
function aliasMembersOf(type: ts.TypeNode): string[] | undefined {
  if (ts.isTypeLiteralNode(type)) return membersOf(type.members)
  if (ts.isIntersectionTypeNode(type)) {
    const parts = type.types.map(aliasMembersOf)
    return parts.every((part) => part !== undefined) ? parts.flat() : undefined
  }
  return undefined
}

/** Generated object type name → its member names, read from the generated file. */
function generatedObjectTypes(): Map<string, string[]> {
  const path = join(packageRoot, 'src/generated/SchemaTypes.ts')
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ES2024)
  const types = new Map<string, string[]>()
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      types.set(statement.name.text, membersOf(statement.members).sort())
    } else if (ts.isTypeAliasDeclaration(statement)) {
      const members = aliasMembersOf(statement.type)
      if (members) types.set(statement.name.text, members.sort())
    }
  }
  return types
}

const titled = loadSchemas().flatMap((schema) => titledObjectsIn(schema, schema.$id, []))
// The fixture envelope only dispatches on `kind`; src/Fixture.ts declares its union by hand.
const generatedTitles = titled.filter((object) => !object.where.endsWith('/fixture.schema.json'))
const generated = generatedObjectTypes()

describe('generated type keys', () => {
  it('no_title_names_two_different_object_schemas', () => {
    const byTitle = new Map<string, TitledObject>()
    const collisions: string[] = []
    for (const object of titled) {
      const previous = byTitle.get(object.title)
      if (previous && previous.properties.join() !== object.properties.join()) {
        collisions.push(`${object.title}: ${previous.where} vs ${object.where}`)
      }
      byTitle.set(object.title, object)
    }
    expect(collisions).toEqual([])
  })

  it.each(generatedTitles.map((object) => [object.title, object] as const))(
    'generated_%s_has_exactly_the_schema_properties',
    (title, object) => {
      expect(generated.get(title), object.where).toEqual(object.properties)
    }
  )

  it('category_catalog_has_only_schema_version_and_assignments', () => {
    expectTypeOf<keyof CategoryCatalog>().toEqualTypeOf<'schemaVersion' | 'assignments'>()
    expect(generated.get('CategoryCatalog')).toEqual(['assignments', 'schemaVersion'])
  })
})
