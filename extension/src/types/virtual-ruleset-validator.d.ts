// SPDX-License-Identifier: AGPL-3.0-or-later
// Generated at build time by config/rulesetValidatorPlugin.ts (Ajv standalone).
declare module 'virtual:monki-ruleset-validator' {
  interface GeneratedValidationError {
    keyword: string
    instancePath: string
    message?: string
  }
  interface GeneratedValidator {
    (value: unknown): boolean
    errors?: GeneratedValidationError[] | null
  }
  export const validateRuleset: GeneratedValidator
}
