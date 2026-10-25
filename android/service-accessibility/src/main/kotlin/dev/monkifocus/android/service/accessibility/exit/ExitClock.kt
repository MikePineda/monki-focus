// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** Port: reads [ExitTime] now. */
fun interface ExitClock {
    fun now(): ExitTime
}
