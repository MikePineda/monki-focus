// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider

/** A fresh in-memory `monki.db` per test (the `RefreshDatabase` of this module). Robolectric only. */
fun inMemoryDatabase(): MonkiDatabase =
    Room
        .inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext<Context>(), MonkiDatabase::class.java)
        .allowMainThreadQueries()
        .build()
