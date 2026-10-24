// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import ts from 'typescript'
import {
  loadAliasMap,
  loadDefaultCategories,
  loadSchemas,
  loadSiteProfiles,
  loadStarterPreset,
  loadSurfaceRegistry,
} from '../../src/index.ts'
import { packageRoot } from '../../src/PackageRoot.ts'
import {
  bundledAliasMap,
  bundledSchemaValidator,
  bundledSchemas,
  defaultCategories,
  siteProfiles,
  starterPreset,
  surfaceRegistry,
} from '../../src/pure.ts'

const NODE_BUILTINS = new Set(builtinModules)

/** Compiles the pure entry as a web worker would: es2024 + webworker libs, no Node types. */
function pureProgram(): ts.Program {
  const configPath = join(packageRoot, 'tsconfig.pure.json')
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      },
    }
  )
  if (!config) throw new Error('tsconfig.pure.json did not parse')
  return ts.createProgram({ rootNames: config.fileNames, options: config.options })
}

function moduleSpecifiersOf(source: ts.SourceFile): string[] {
  return source.statements.flatMap((statement) =>
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
    statement.moduleSpecifier !== undefined &&
    ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : []
  )
}

describe('browser-safe entry point', () => {
  const program = pureProgram()
  const ownSources = program
    .getSourceFiles()
    .filter((file) => file.fileName.startsWith(join(packageRoot, 'src')))

  it('pure_entry_type_checks_for_a_web_worker_without_node_types', () => {
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    expect(diagnostics).toEqual([])
    expect(program.getSourceFiles().map((file) => file.fileName)).not.toContainEqual(
      expect.stringContaining('@types/node')
    )
    expect(ownSources.map((file) => file.fileName)).toContainEqual(
      expect.stringMatching(/src\/pure\.ts$/)
    )
  }, 30_000)

  it('pure_entry_graph_never_imports_a_node_builtin', () => {
    const offenders = ownSources.flatMap((source) =>
      moduleSpecifiersOf(source)
        .filter((specifier) => specifier.startsWith('node:') || NODE_BUILTINS.has(specifier))
        .map((specifier) => `${source.fileName}: ${specifier}`)
    )
    expect(offenders).toEqual([])
  })

  it('package_exports_the_pure_and_node_entries', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>
    }
    expect(manifest.exports['./pure']).toEqual({
      types: './dist/pure.d.ts',
      default: './dist/pure.js',
    })
    expect(manifest.exports['./node']).toEqual(manifest.exports['.'])
    expect(manifest.exports['./validator']).toBeDefined()
  })

  it('bundled_schemas_are_the_schema_files', () => {
    expect(bundledSchemas).toEqual(loadSchemas())
  })

  it('bundled_data_is_the_validated_data_files', () => {
    expect(surfaceRegistry).toEqual(loadSurfaceRegistry())
    expect(siteProfiles).toEqual(loadSiteProfiles().map((file) => file.profile))
    expect(defaultCategories).toEqual(loadDefaultCategories())
    expect(starterPreset).toEqual(loadStarterPreset())
  })

  it('bundled_validator_knows_the_site_aliases', () => {
    expect(bundledAliasMap).toEqual(loadAliasMap())
    expect(bundledSchemaValidator().validate('ruleset', starterPreset)).toEqual({ valid: true })
    const duplicated = structuredClone(starterPreset)
    const [first] = duplicated.rules
    if (!first) throw new Error('the starter preset has no rules')
    duplicated.rules.push({ ...first })
    expect(bundledSchemaValidator().validate('ruleset', duplicated)).toMatchObject({
      valid: false,
      code: 'duplicate_key',
    })
  })
})
