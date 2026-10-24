// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.Application

/**
 * Owns the [AppGraph]. The accessibility service and the workers reach it
 * with `(applicationContext as MonkiApplication).graph`.
 */
class MonkiApplication : Application() {
    val graph: AppGraph by lazy { AppGraph(this) }
}
