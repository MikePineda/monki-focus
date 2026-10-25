// SPDX-License-Identifier: AGPL-3.0-or-later
import { bundledSchemas, schemaIdOf } from '@monki-focus/rules/pure'
import * as ajv2020 from 'ajv/dist/2020.js'
import type * as Ajv2020Module from 'ajv/dist/2020.js'
import standaloneModule from 'ajv/dist/standalone/index.js'
import formatsModule from 'ajv-formats'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Import id of the precompiled rule set validator. */
export const RULESET_VALIDATOR_MODULE = 'virtual:monki-ruleset-validator'
/** Import id of the precompiled validator of one stored escalation state. */
export const ESCALATION_VALIDATOR_MODULE = 'virtual:monki-escalation-validator'
/** Import id of the precompiled native messaging (bridge) payload validators. */
export const BRIDGE_VALIDATOR_MODULE = 'virtual:monki-bridge-validator'

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
 * Generates the ES module source of precompiled validators, one export per
 * entry of `exported` (export name to schema id or `id#/$defs/…` pointer).
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
function validatorSource(exported: Record<string, string>): string {
  return standaloneSource(rulesAjv(), exported, true)
}

function rulesAjv(): Ajv2020Module.Ajv2020 {
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
  return ajv
}

/** The ES module source of `exported`, compiled by `ajv` (see `validatorSource`). */
function standaloneSource(
  ajv: Ajv2020Module.Ajv2020,
  exported: Record<string, string>,
  withKeywordChecks: boolean
): string {
  const generated = standaloneCode(ajv, exported)

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
    ...(withKeywordChecks
      ? [
          `import { rulesetKeywordChecks as __monkiKeywordChecks } from ${JSON.stringify(KEYWORD_CHECKS_PATH)};`,
        ]
      : []),
    ...[...imports].map(
      ([path, name]) => `import * as ${name}Namespace from ${JSON.stringify(path)};`
    ),
    'const cjsExports = (namespace) => namespace.default && typeof namespace.default === "object" && namespace.default.__esModule ? namespace.default : namespace;',
    ...[...imports.values()].map((name) => `const ${name} = cjsExports(${name}Namespace);`),
  ]
  return `${header.join('\n')}\n${body.replace(/^"use strict";/, '')}\n`
}

/** `validateRuleset` for `ruleset` documents (options page and service worker). */
export function rulesetValidatorSource(): string {
  return validatorSource({ validateRuleset: schemaIdOf('ruleset') })
}

/**
 * `validateEscalationState` for one stored state
 * (`escalation.schema.json#/$defs/state`), in its own module so the pages
 * that only validate rule sets do not carry it.
 */
export function escalationValidatorSource(): string {
  return validatorSource({ validateEscalationState: `${schemaIdOf('escalation')}#/$defs/state` })
}

/**
 * Export name of each bridge payload validator, by message type. The schemas
 * are `@monki-focus/protocol/schema/bridge` (the native messaging contract
 * MonkiCore implements too); the envelope itself is checked by
 * `BridgeMessageValidator.ts` in the same order as MonkiCore.
 */
export const BRIDGE_PAYLOAD_VALIDATORS = {
  'hello': 'validateHello',
  'browser.focus': 'validateBrowserFocus',
  'browser.activity': 'validateBrowserActivity',
  'bypass.event': 'validateBypassEvent',
  'hello.ack': 'validateHelloAck',
  'rules.snapshot': 'validateRulesSnapshot',
  'unlock.token': 'validateUnlockToken',
  'focusSession.state': 'validateFocusSessionState',
  'app.unavailable': 'validateAppUnavailable',
} as const

/** `hello.ack` → `bridge-hello-ack`, the schema id stem of a message type. */
function bridgeSchemaStem(type: string): string {
  return `bridge-${type
    .replace('.', '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()}`
}

/** The JSON Schemas of `@monki-focus/protocol/schema/bridge`. */
export function bridgeSchemas(): Record<string, unknown>[] {
  const require = createRequire(import.meta.url)
  const dir = dirname(require.resolve('@monki-focus/protocol/schema/bridge/envelope.schema.json'))
  return readdirSync(dir)
    .filter((file) => file.endsWith('.schema.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>)
}

/** One validator per bridge payload schema (`BRIDGE_PAYLOAD_VALIDATORS`). */
export function bridgeValidatorSource(): string {
  const ajv = new Ajv2020({ strict: true, allErrors: true, code: { source: true, esm: true } })
  for (const schema of bridgeSchemas()) ajv.addSchema(schema)
  const exported = Object.fromEntries(
    Object.entries(BRIDGE_PAYLOAD_VALIDATORS).map(([type, name]) => [
      name,
      `urn:monki-focus:protocol:${bridgeSchemaStem(type)}:v1`,
    ])
  )
  return standaloneSource(ajv, exported, false)
}

const SOURCES: Readonly<Record<string, () => string>> = {
  [RULESET_VALIDATOR_MODULE]: rulesetValidatorSource,
  [ESCALATION_VALIDATOR_MODULE]: escalationValidatorSource,
  [BRIDGE_VALIDATOR_MODULE]: bridgeValidatorSource,
}

/** Serves the precompiled validator modules to the extension build and to Vitest. */
export function rulesetValidatorPlugin(): Plugin {
  const sources = new Map<string, string>()
  return {
    name: 'monki-ruleset-validator',
    resolveId(id) {
      return Object.hasOwn(SOURCES, id) ? `\0${id}` : null
    },
    load(id) {
      const module = id.startsWith('\0') ? id.slice(1) : null
      if (module === null || !Object.hasOwn(SOURCES, module)) return null
      let source = sources.get(module)
      if (source === undefined) {
        source = (SOURCES[module] as () => string)()
        sources.set(module, source)
      }
      return source
    },
  }
}
