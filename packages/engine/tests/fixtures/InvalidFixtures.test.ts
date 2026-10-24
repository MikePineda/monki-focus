// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import { schemaValidator } from '@monki-focus/rules'
import { describeFixtures } from './FixtureRunner.ts'

/** Validation is delegated to the rules package validator; the engine trusts validated input. */
describeFixtures('invalid', (fixture) => {
  const result = schemaValidator().validate(fixture.schema, fixture.document)
  expect(result.valid).toBe(false)
  expect(result.valid ? null : { rejected: true, code: result.code }).toEqual(fixture.then)
})
