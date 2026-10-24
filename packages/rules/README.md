# `@monki-focus/rules`

The single source of truth for monki-focus rules: JSON Schemas (draft
2020-12), the surface registry and site profiles, default categories, the
starter preset and the cross-platform conformance fixtures. The TypeScript
engine (`packages/engine`), Android (`:core-domain`) and macOS (`MonkiCore`)
all run the same fixtures. There is **no decision logic** here; the semantics
every engine implements are in [SEMANTICS.md](SEMANTICS.md).

```
schema/v1/*.schema.json      contracts (strict: unknown fields rejected, unique keys via x-uniqueBy, documents <= 256 KiB)
data/surfaces.json           surface registry (feed | permalink | utility)
data/sites/<domain>.json     site profiles: URL path globs -> surfaces (no DOM selectors)
data/categories/default.json factory category levels (0/25/50/75/100)
data/presets/starter.ruleset.json  generic starter rule set
detectors/android/           Android detector packs (schema now, packs with the Android work package)
fixtures/<kind>/*.json       conformance fixtures, one spec per file
src/                         loadFixtures, schema validator, typed data readers, invariant checker
src/generated/SchemaTypes.ts TypeScript types generated from the schemas (committed)
```

## Use from TypeScript

```ts
import { loadFixtures } from '@monki-focus/rules'

describe.each(loadFixtures('decision'))('$id', (fixture) => {
  it('decides as specified', () => {
    expect(decide(fixture.given, fixture.when.target)).toEqual(fixture.then)
  })
})
```

`loadFixtures(kind)` validates every file against its schema and throws on an
unknown kind, an invalid fixture or one filed under the wrong directory.
`createSchemaValidator(schemas)` (also at `@monki-focus/rules/validator`, no
Node APIs) validates rule sets in a browser; `schemaValidator()` is the
Node-side instance over the package's own schemas.

Browsers and service workers import `@monki-focus/rules/pure`: the generated
types, the bundled schemas, surfaces, site profiles, default categories and
starter preset as imported JSON, and `bundledSchemaValidator()`. Its module
graph never touches a Node builtin (a test compiles it with only the `es2024`
and `webworker` libs). The root entry (also `@monki-focus/rules/node`) adds the
file-system readers such as `loadFixtures`.

```ts
import { bundledSchemaValidator, starterPreset } from '@monki-focus/rules/pure'
```

Validators on every platform must also enforce the `x-uniqueBy` extension
keyword (duplicate rule ids, category targets, escalation groups or surface ids
are invalid), `x-registrableDomain` and `x-timeZone` (a zone the platform's
time zone database cannot resolve is rejected with `invalid_time_zone`). Kotlin and Swift read `schema/`, `data/` and `fixtures/` by relative path and
validate fixtures against `schema/v1/fixture.schema.json`.

## Scripts

```bash
npm test -w @monki-focus/rules       # schemas, data, fixtures, invariants, generated-types drift
npm run generate -w @monki-focus/rules   # regenerate src/generated/SchemaTypes.ts after a schema change
npm run build -w @monki-focus/rules  # generate + compile to dist/
```

The generated types are committed so that typecheck, lint and tests never
depend on build order and schema changes show up in review as type diffs; a
test fails if the file drifts from the schemas.

## Changing a contract

Change the fixture first, then the schema and `SEMANTICS.md`, regenerate the
types and let every platform's runner go red before it goes green. A breaking
schema change creates `schema/v2/`; clients read the current and previous
major.
