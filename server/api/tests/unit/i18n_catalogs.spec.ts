// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { readdir, readFile } from 'node:fs/promises'
import { SUPPORTED_LOCALES } from '#http/supported_locales'

/** [key, value] pairs of a nested catalog. */
function entries(value: unknown, prefix = ''): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[prefix, value]]
  return Object.entries(value).flatMap(([key, child]) =>
    entries(child, prefix ? `${prefix}.${key}` : key)
  )
}

/** `{name}` placeholders of an ICU message. */
function placeholders(message: unknown): string[] {
  return [...String(message).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

async function catalog(locale: string, file: string) {
  return JSON.parse(await readFile(join(app.languageFilesPath(), locale, file), 'utf8'))
}

async function catalogFiles(locale: string) {
  const files = await readdir(join(app.languageFilesPath(), locale))
  return files.sort()
}

test.group('Translation catalogs', () => {
  test('test_every_locale_has_the_same_catalog_files', async ({ assert }) => {
    const [reference, ...others] = await Promise.all(SUPPORTED_LOCALES.map(catalogFiles))

    for (const files of others) assert.deepEqual(files, reference)
    assert.includeMembers(reference, ['errors.json', 'validator.json'])
  })

  test('test_every_key_exists_in_every_locale', async ({ assert }) => {
    for (const file of await catalogFiles(SUPPORTED_LOCALES[0])) {
      const [reference, ...others] = await Promise.all(
        SUPPORTED_LOCALES.map(async (locale) =>
          entries(await catalog(locale, file))
            .map(([key]) => key)
            .sort()
        )
      )
      for (const keys of others) assert.deepEqual(keys, reference, file)
    }
  })

  test('test_no_translation_is_empty', async ({ assert }) => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const file of await catalogFiles(locale)) {
        for (const [key, value] of entries(await catalog(locale, file))) {
          assert.isString(value, `${locale}/${file}:${key}`)
          assert.isNotEmpty((value as string).trim(), `${locale}/${file}:${key}`)
        }
      }
    }
  })

  test('test_translations_keep_the_same_placeholders', async ({ assert }) => {
    const [reference, ...others] = SUPPORTED_LOCALES
    for (const file of await catalogFiles(reference)) {
      const base = new Map(entries(await catalog(reference, file)))
      for (const locale of others) {
        for (const [key, value] of entries(await catalog(locale, file))) {
          assert.deepEqual(
            placeholders(value),
            placeholders(base.get(key)),
            `${locale}/${file}:${key}`
          )
        }
      }
    }
  })
})
