// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The bundled rules data the engine needs, passed in rather than read from
 * disk so the engine stays pure: site profiles (aliases and surface globs),
 * the surface registry (feed / permalink / utility) and the default category
 * assignments. Adapters build it once from `@monki-focus/rules` data (Node
 * readers on the server, JSON imports in the extension bundle).
 */
import type { CategoryAssignment, SiteProfile, Surface, SurfaceKind } from '@monki-focus/rules'
import { aliasTableOf, isDomainOrSubdomain, normaliseDomain } from './DomainNormaliser.ts'
import type { AliasTable } from './DomainNormaliser.ts'

export interface RulesCatalogInput {
  siteProfiles: readonly SiteProfile[]
  surfaces: readonly Surface[]
  defaultCategories: readonly CategoryAssignment[]
}

export interface ProfileSurface {
  surface: string
  globs: readonly string[]
}

export interface CompiledProfile {
  domain: string
  surfaces: readonly ProfileSurface[]
}

export interface RulesCatalog {
  readonly aliases: AliasTable
  readonly profiles: readonly CompiledProfile[]
  readonly defaultCategories: readonly CategoryAssignment[]
  /** Kind of a registered surface, or null for an unknown id. */
  surfaceKind(surface: string): SurfaceKind | null
  /** §3.1 normalisation of a rule, category or unlock domain. */
  normaliseDomain(domain: string): string
  /** The profile whose domain equals the (normalised) host or is a dot-suffix of it. */
  profileForHost(host: string): CompiledProfile | null
}

export function createRulesCatalog(input: RulesCatalogInput): RulesCatalog {
  const aliasMap: Record<string, string> = {}
  for (const profile of input.siteProfiles) {
    for (const alias of profile.aliases) aliasMap[alias] = profile.domain
  }
  const aliases = aliasTableOf(aliasMap)
  const profiles: CompiledProfile[] = input.siteProfiles
    .map((profile) => ({
      domain: profile.domain,
      surfaces: Object.entries(profile.surfaces)
        .map(([surface, globs]) => ({ surface, globs: globs ?? [] }))
        .sort((a, b) => (a.surface < b.surface ? -1 : 1)),
    }))
    // Longest domain first: a profile for a subdomain wins over its parent's.
    .sort((a, b) => b.domain.length - a.domain.length)
  const kinds = new Map(input.surfaces.map((surface) => [surface.id, surface.kind]))
  return {
    aliases,
    profiles,
    defaultCategories: input.defaultCategories,
    surfaceKind: (surface) => kinds.get(surface) ?? null,
    normaliseDomain: (domain) => normaliseDomain(domain, aliases),
    profileForHost: (host) =>
      profiles.find((profile) => isDomainOrSubdomain(host, profile.domain)) ?? null,
  }
}
