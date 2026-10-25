// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Device conditions that make bypassing easier, reported with every
 * heartbeat (openapi.yaml `HeartbeatRequest.riskState`) and shown to the
 * user and the guardian as codes.
 */
export const RISK_STATES = [
  'developer_options',
  'usb_debugging',
  'auto_time_off',
  'time_changed',
  'timezone_changed',
] as const

export type RiskState = (typeof RISK_STATES)[number]

export const MAX_RISK_STATES = 16
