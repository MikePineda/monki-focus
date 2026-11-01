// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import { bundledSchemaValidator } from '@monki-focus/rules/pure'
import { isNotModified } from '#domain/rules/rule_set_etag'
import { checkIfMatch, type IfMatchRefusal } from '#domain/rules/rule_set_precondition'
import { canonicalJson, ruleSetContentHash } from '#domain/rules/rule_set_content_hash'
import { ruleSetProblems } from '#domain/rules/rule_set_problems'
import RuleSetStore from '#services/rules/rule_set_store'

export type RuleSetRead =
  | { readonly kind: 'not_modified'; readonly revision: number }
  | { readonly kind: 'current'; readonly revision: number; readonly ruleSet: unknown }

export type RuleSetWriteOutcome =
  | { readonly kind: 'saved'; readonly revision: number }
  | {
      readonly kind: 'precondition_failed'
      readonly reason: IfMatchRefusal
      readonly revision: number
    }
  | { readonly kind: 'invalid'; readonly fields: Record<string, string> }

export interface RuleSetWriteRequest {
  readonly ifMatch: string | null | undefined
  readonly ruleSet: unknown
  /** The writing device, or null for the web dashboard. */
  readonly deviceId: number | null
  readonly now: DateTime
}

/**
 * Rule set sync (S15), shared by the device routes and the dashboard. The
 * server only stores, versions and validates: it never decides whether a
 * change tightens or loosens. Every device applies an incoming set through
 * its own `RuleChangePolicy` (packages/rules/SEMANTICS.md §8: tightening at
 * once, loosening from the next local day).
 *
 * A write is checked in this order: `If-Match` against the current revision
 * (412), then the document with the shared schema validator of
 * `@monki-focus/rules` (the same one the extension runs: 256 KiB of
 * canonical UTF-8, JSON, schema; 422), then a compare-and-swap. A write
 * whose content hash equals the stored one keeps the revision.
 */
@inject()
export default class RuleSetSync {
  constructor(protected store: RuleSetStore) {}

  async read(userId: number, ifNoneMatch: string | null | undefined): Promise<RuleSetRead> {
    const stored = await this.store.find(userId)
    const revision = stored?.revision ?? 0
    if (isNotModified(ifNoneMatch, revision)) return { kind: 'not_modified', revision }
    return { kind: 'current', revision, ruleSet: stored?.document ?? null }
  }

  async write(userId: number, request: RuleSetWriteRequest): Promise<RuleSetWriteOutcome> {
    const stored = await this.store.find(userId)
    const current = stored?.revision ?? 0
    const precondition = checkIfMatch(request.ifMatch, current)
    if (!precondition.ok) {
      return { kind: 'precondition_failed', reason: precondition.reason, revision: current }
    }

    const validation = bundledSchemaValidator().validateDocument(
      'ruleset',
      canonicalJson(request.ruleSet ?? null)
    )
    if (!validation.valid) return { kind: 'invalid', fields: ruleSetProblems(validation) }

    const contentHash = ruleSetContentHash(request.ruleSet)
    if (stored !== null && stored.contentHash === contentHash) {
      return { kind: 'saved', revision: current }
    }

    const swapped = await this.store.compareAndSwap(userId, current, {
      document: request.ruleSet,
      contentHash,
      deviceId: request.deviceId,
      now: request.now,
    })
    if (!swapped.ok) {
      return { kind: 'precondition_failed', reason: 'revision_mismatch', revision: swapped.current }
    }
    return { kind: 'saved', revision: swapped.revision }
  }
}
