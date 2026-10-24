// SPDX-License-Identifier: AGPL-3.0-or-later
import { bundledSchemas, schemaIdOf } from '@monki-focus/rules/pure'
import * as ajv2020 from 'ajv/dist/2020.js'
import type * as Ajv2020Module from 'ajv/dist/2020.js'
import standaloneModule from 'ajv/dist/standalone/index.js'
import formatsModule from 'ajv-formats'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Import id of the precompiled rule set validator. */
export const RULESET_VALIDATOR_MODULE = 'virtual:monki-ruleset-validator'
const RESOLVED_ID = `\0${RULESET_VALIDATOR_MODULE}`

/** The custom keywords of the rules schemas and the check each one calls at run time. */
const CUSTOM_KEYWORDS = [
  { keyword: 'x-uniqueBy', type: 'array', schemaType: 'string', check: 'uniqueBy' },
  {
    keyword: 'x-registrableDomain',
    type: 'string',
    schemaType: 'boolean',
    check: 'registrableDomain',
  },
  { keyword: 'x-timeZone', type: 'string', schemaType: 'boolean', check: 'timeZone' },
] as const

const KEYWORD_CHECKS_PATH = fileURLToPath(
  new URL('../src/shared/RulesetKeywordChecks.ts', import.meta.url)
)

const { Ajv2020, _ } = ajv2020 as unknown as {
  Ajv2020: typeof Ajv2020Module.Ajv2020
  _: typeof Ajv2020Module._
}
const standaloneCode = (standaloneModule as unknown as { default: typeof standaloneModule }).default
const addFormats = formatsModule.default

/**
 * Generates the ES module source of a validator for `ruleset` documents.
 *
 * Ajv compiles schemas with `new Function`, which the MV3 content security
 * policy forbids in every extension context, so the extension cannot build
 * `bundledSchemaValidator()` at run time. Instead the same Ajv, with the
 * same options and the same bundled schemas as `@monki-focus/rules`,
 * generates the validation code at build time (Ajv "standalone"). The three
 * custom keywords become calls into `RulesetKeywordChecks.ts`, and the
 * `require(...)` calls Ajv emits for its runtime helpers become imports.
 * `RulesetValidation.test.ts` runs the rules package's `invalid` fixtures
 * through it and through the shared validator and expects the same verdicts.
 */
export function rulesetValidatorSource(): string {
  const ajv = new Ajv2020({
    strict: true,
    strictRequired: false,
    allErrors: true,
    allowUnionTypes: true,
    code: { source: true, esm: true },
  })
  addFormats(ajv, ['date-time', 'date'])
  for (const { keyword, type, schemaType, check } of CUSTOM_KEYWORDS) {
    ajv.addKeyword({
      keyword,
      type,
      schemaType,
      code(context) {
        const fn = context.gen.scopeValue('keyword', {
          ref: () => true,
          code: _`__monkiKeywordChecks[${check}]`,
        })
        context.fail(_`!${fn}(${context.schemaCode}, ${context.data})`)
      },
    })
  }
  for (const schema of bundledSchemas) ajv.addSchema(schema)
  const generated = standaloneCode(ajv, { validateRuleset: schemaIdOf('ruleset') })

  const imports = new Map<string, string>()
  const body = generated.replace(/require\("([^"]+)"\)/g, (_match, specifier: string) => {
    const path = specifier.endsWith('.js') ? specifier : `${specifier}.js`
    let name = imports.get(path)
    if (name === undefined) {
      name = `__ajvRuntime${imports.size}`
      imports.set(path, name)
    }
    return name
  })
  // Each helper is a CommonJS module; `cjsExports` recovers its `module.exports`
  // whether the importer is Node (namespace `default` = module.exports) or the
  // bundler (namespace = the exports of a module marked `__esModule`).
  const header = [
    `import { rulesetKeywordChecks as __monkiKeywordChecks } from ${JSON.stringify(KEYWORD_CHECKS_PATH)};`,
    ...[...imports].map(
      ([path, name]) => `import * as ${name}Namespace from ${JSON.stringify(path)};`
    ),
    'const cjsExports = (namespace) => namespace.default && typeof namespace.default === "object" && namespace.default.__esModule ? namespace.default : namespace;',
    ...[...imports.values()].map((name) => `const ${name} = cjsExports(${name}Namespace);`),
  ]
  return `${header.join('\n')}\n${body.replace(/^"use strict";/, '')}\n`
}

/** Serves `virtual:monki-ruleset-validator` to the extension build and to Vitest. */
export function rulesetValidatorPlugin(): Plugin {
  let source: string | undefined
  return {
    name: 'monki-ruleset-validator',
    resolveId(id) {
      return id === RULESET_VALIDATOR_MODULE ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      source ??= rulesetValidatorSource()
      return source
    },
  }
}
