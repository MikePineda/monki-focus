// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  BOOT_ID_PATTERN,
  NONCE_PATTERN,
  RELEASE_ISSUER_PATTERN,
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
        'POST /device/token/rotate',
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

  it('test_every_time_anchoring_response_carries_server_time_and_a_signed_time_token', () => {
    const schemas = spec.components.schemas as Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >
    expect(schemas.HeartbeatResponse?.required).toEqual(
      expect.arrayContaining(['serverTime', 'timeToken'])
    )
    expect(schemas.UnlockRequestStatus?.required).toContain('serverTime')
    expect(Object.keys(schemas.UnlockRequestStatus?.properties ?? {})).toContain('timeToken')
    expect(schemas.EnrollResponse?.required).toContain('serverTime')
    expect(schemas.HeartbeatRequest?.required).toEqual(
      expect.arrayContaining(['nonce', 'boot', 'pinnedKids'])
    )
  })

  it('test_revocations_travel_only_inside_the_signed_time_token', () => {
    expect(readFileSync(specPath, 'utf8')).not.toMatch(/revokedTokens|RevokedToken/)
  })

  it('test_enrolment_codes_lock_after_five_failed_attempts', () => {
    const enroll = spec.paths['/device/enroll']?.post as unknown as { description: string }
    expect(enroll.description).toMatch(/at most 5 failed\s+attempts/)
  })

  it('test_device_tokens_are_returned_only_by_enrolment_and_rotation', () => {
    const schemas = spec.components.schemas as Record<
      string,
      { properties?: Record<string, { $ref?: string }> }
    >
    const carriers = Object.entries(schemas)
      .filter(([, schema]) =>
        Object.values(schema.properties ?? {}).some(
          (property) => property.$ref === '#/components/schemas/DeviceToken'
        )
      )
      .map(([name]) => name)
    expect(carriers.sort()).toEqual(['EnrollResponse', 'TokenRotation'])
    const token = spec.components.schemas.DeviceToken as { pattern: string }
    expect(new RegExp(token.pattern).test('mfd_MQ.' + 'a'.repeat(40))).toBe(true)
    expect(new RegExp(token.pattern).test('oat_MQ.' + 'a'.repeat(40))).toBe(false)
  })

  it('test_bypass_details_cannot_carry_a_url_or_free_text', () => {
    const event = spec.components.schemas.BypassEvent as {
      properties: { details: { additionalProperties: { pattern: string } } }
    }
    const value = new RegExp(event.properties.details.additionalProperties.pattern)
    expect(value.test('social.video')).toBe(true)
    for (const leak of ['https://example.com/a', 'a title with spaces', 'user@example.com']) {
      expect(value.test(leak)).toBe(false)
    }
  })

  it('test_nonce_boot_and_issuer_formats_match_the_tokens', () => {
    const schemas = spec.components.schemas as Record<
      string,
      { pattern?: string; properties?: Record<string, { pattern?: string }> }
    >
    expect(new RegExp(schemas.Nonce?.pattern ?? '').source).toBe(NONCE_PATTERN.source)
    expect(new RegExp(schemas.BootId?.pattern ?? '').source).toBe(BOOT_ID_PATTERN.source)
    expect(new RegExp(schemas.KeySet?.properties?.issuer?.pattern ?? '').source).toBe(
      RELEASE_ISSUER_PATTERN.source
    )
  })
})
