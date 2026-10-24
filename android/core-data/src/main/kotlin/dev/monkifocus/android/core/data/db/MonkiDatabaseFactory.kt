// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import android.content.Context
import androidx.room.Room

/**
 * Opens the app's database in its private storage (excluded from backup and
 * device transfer by `:app`'s `data_extraction_rules`). There is no
 * destructive fallback: a missing migration is a crash in testing, never a
 * silent wipe of the user's history.
 */
object MonkiDatabaseFactory {
    fun open(context: Context): MonkiDatabase =
        Room
            .databaseBuilder(context.applicationContext, MonkiDatabase::class.java, MonkiDatabase.NAME)
            .build()
}
