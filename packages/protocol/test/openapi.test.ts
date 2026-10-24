// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  RULE_ID_PATTERN,
  SCOPE_APP_PATTERN,
  SCOPE_DOMAIN_PATTERN,
  SCOPE_PATH_PATTERN,
  UUID_PATTERN,
} from '../src/claim_formats.ts'
import { packageRoot } from './token_vector_loader.ts'

const specPath = join(packageRoot, 'openapi.yaml')

interface Operation {
  operationId: string
  security?: unknown[]
  parameters?: { $ref?: string }[]
  responses: Record<string, unknown>
}
type PathItem = Record<string, Operation> & { parameters?: { $ref?: string }[] }
interface Spec {
  openapi: string
  paths: Record<string, PathItem>
  components: { schemas: Record<string, Record<string, unknown>> }
}

const spec = parse(readFileSync(specPath, 'utf8')) as Spec
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

function operations(): [string, string, Operation, PathItem][] {
  const found: [string, string, Operation, PathItem][] = []
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const operation = item[method]
      if (operation !== undefined) found.push([method.toUpperCase(), path, operation, item])
    }
  }
  return found
}

describe('openapi.yaml', () => {
  it('test_openapi_document_is_valid_openapi_3_1', async () => {
    expect(spec.openapi).toMatch(/^3\.1\./)
    await expect(SwaggerParser.validate(specPath)).resolves.toBeDefined()
  })

  it('test_openapi_covers_the_phase_3_device_endpoints', () => {
    const routes = operations().map(([method, path]) => `${method} ${path}`)
    expect(routes).toEqual(
      expect.arrayContaining([
        'GET /keys',
        'POST /device/enroll',
        'POST /device/heartbeat',
        'POST /device/bypass-events',
        'POST /device/unlock-requests',
        'GET /device/unlock-requests/{uuid}',
        'DELETE /device/unlock-requests/{uuid}',
      ])
    )
  })

  it.each(
    operations().map(
      ([method, path, operation, item]) => [`${method} ${path}`, operation, item] as const
    )
  )('test_%s_sends_client_version_and_documents_426', (_route, operation, item) => {
    const refs = [...(item.parameters ?? []), ...(operation.parameters ?? [])].map((p) => p.$ref)
    expect(refs).toContain('#/components/parameters/ClientVersion')
    expect(Object.keys(operation.responses)).toContain('426')
  })

  it('test_only_keys_and_enroll_are_unauthenticated', () => {
    const open = operations()
      .filter(
        ([, , operation]) => Array.isArray(operation.security) && operation.security.length === 0
      )
      .map(([method, path]) => `${method} ${path}`)
    expect(open.sort()).toEqual(['GET /keys', 'POST /device/enroll'])
  })

  it('test_openapi_unlock_scope_matches_the_token_claim_formats', () => {
    const scope = spec.components.schemas.UnlockScope as {
      oneOf: { properties: { value: { pattern: string } } }[]
    }
    const patterns = scope.oneOf.map(
      (variant) => new RegExp(variant.properties.value.pattern).source
    )
    expect(patterns).toEqual([
      SCOPE_DOMAIN_PATTERN.source,
      SCOPE_PATH_PATTERN.source,
      SCOPE_APP_PATTERN.source,
    ])
    const uuid = spec.components.schemas.Uuid as { pattern: string }
    expect(new RegExp(uuid.pattern).source).toBe(UUID_PATTERN.source)
    const create = spec.components.schemas.UnlockRequestCreate as {
      properties: { ruleId: { pattern: string } }
    }
    expect(new RegExp(create.properties.ruleId.pattern).source).toBe(RULE_ID_PATTERN.source)
  })

  it('test_every_object_schema_is_closed', () => {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (schema.type === 'object') {
        expect(schema.additionalProperties, name).toBe(false)
      }
    }
  })
})
