// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateSchemaTypes } from '../../scripts/SchemaTypeGenerator.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

describe('generated types', () => {
  it('committed_types_match_the_schemas', async () => {
    const committed = readFileSync(join(packageRoot, 'src/generated/SchemaTypes.ts'), 'utf8')
    expect(await generateSchemaTypes()).toBe(committed)
  }, 30_000)
})
