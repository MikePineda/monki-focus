// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateSchemaTypes, generatedTypesPath } from './SchemaTypeGenerator.ts'

mkdirSync(dirname(generatedTypesPath), { recursive: true })
writeFileSync(generatedTypesPath, await generateSchemaTypes())
console.log(`wrote ${generatedTypesPath}`)
