// SPDX-License-Identifier: AGPL-3.0-or-later
// Generated at build time by config/rulesetValidatorPlugin.ts (Ajv standalone)
// from @monki-focus/protocol/schema/bridge: one validator per message payload.
declare module 'virtual:monki-bridge-validator' {
  type PayloadValidator = (value: unknown) => boolean
  export const validateHello: PayloadValidator
  export const validateBrowserFocus: PayloadValidator
  export const validateBrowserActivity: PayloadValidator
  export const validateBypassEvent: PayloadValidator
  export const validateHelloAck: PayloadValidator
  export const validateRulesSnapshot: PayloadValidator
  export const validateUnlockToken: PayloadValidator
  export const validateFocusSessionState: PayloadValidator
  export const validateAppUnavailable: PayloadValidator
}
