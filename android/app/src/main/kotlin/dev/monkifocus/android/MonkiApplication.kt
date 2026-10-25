// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.Application
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraph
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraphProvider

/**
 * Owns the [AppGraph]. The accessibility service and the workers reach it
 * with `(applicationContext as MonkiApplication).graph`; the protection
 * module, which cannot see this class, through [ProtectionGraphProvider].
 */
class MonkiApplication :
    Application(),
    ProtectionGraphProvider {
    val graph: AppGraph by lazy { AppGraph(this) }

    override val protectionGraph: ProtectionGraph get() = graph.protection
}
