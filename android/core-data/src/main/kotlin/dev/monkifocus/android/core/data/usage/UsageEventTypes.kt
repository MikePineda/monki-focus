// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/**
 * The `UsageEvents.Event` type constants the mapper reads, as plain values so
 * the mapping stays pure Kotlin (`UsageEventTypesTest` pins them to the
 * platform's). API 29+ (minSdk).
 */
object UsageEventTypes {
    const val ACTIVITY_RESUMED = 1
    const val ACTIVITY_PAUSED = 2
    const val SCREEN_INTERACTIVE = 15
    const val SCREEN_NON_INTERACTIVE = 16
    const val KEYGUARD_SHOWN = 17
    const val KEYGUARD_HIDDEN = 18
    const val DEVICE_SHUTDOWN = 26
}
