// SPDX-License-Identifier: AGPL-3.0-or-later

/** Languages every catalog ships in (server, dashboard and clients). */
export const SUPPORTED_LOCALES = ['en', 'es'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
