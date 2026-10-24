// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.Application
import java.time.Clock

/**
 * Composition root (manual DI): constructor injection, one `lazy` per
 * singleton, an interface per domain port. The only place that touches the
 * system clock; domain code receives it as a parameter.
 */
class AppGraph(
    val application: Application,
) {
    val wallClock: Clock by lazy { Clock.systemUTC() }
}
