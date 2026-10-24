// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadSchemas } from '../../src/index.ts'
import { listDataFiles } from '../../src/DataFiles.ts'

const REGEX_LIKE_NAME = /^(regex|regexp|pattern|patterns|.*Regex|.*Pattern)$/

function propertyNamesOf(node: unknown, names: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) propertyNamesOf(child, names)
  } else if (node !== null && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key === 'properties') {
        for (const name of Object.keys(child as object)) names.add(name)
      }
      propertyNamesOf(child, names)
    }
  }
  return names
}

function keysOf(node: unknown, keys: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) keysOf(child, keys)
  } else if (node !== null && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      keys.add(key)
      keysOf(child, keys)
    }
  }
  return keys
}

describe('no arbitrary regex in rules data', () => {
  it('no_schema_offers_a_regex_field', () => {
    const offered = new Set<string>()
    for (const schema of loadSchemas()) propertyNamesOf(schema, offered)
    expect([...offered].filter((name) => REGEX_LIKE_NAME.test(name))).toEqual([])
  })

  it('data_files_contain_no_regex_fields', () => {
    const keys = new Set<string>()
    for (const file of listDataFiles()) keysOf(JSON.parse(readFileSync(file.path, 'utf8')), keys)
    expect([...keys].filter((key) => REGEX_LIKE_NAME.test(key))).toEqual([])
  })
})
