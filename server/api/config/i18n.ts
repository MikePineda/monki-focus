// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'
import { SUPPORTED_LOCALES } from '#http/supported_locales'

/**
 * Server-side translations: error messages, validation messages and
 * notification texts. Catalogs live in `resources/lang/<locale>/` and
 * tests/unit/i18n_catalogs.spec.ts keeps every locale in parity.
 */
const i18nConfig = defineConfig({
  defaultLocale: env.get('APP_DEFAULT_LOCALE') ?? 'en',
  supportedLocales: [...SUPPORTED_LOCALES],
  formatter: formatters.icu(),

  loaders: [
    loaders.fs({
      location: app.languageFilesPath(),
    }),
  ],
})

export default i18nConfig
