// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** The user settings and the device's random id. */
interface SettingsRepository {
    /** The stored settings, with defaults for anything never set. */
    suspend fun current(): Settings

    /** Applies [transform] atomically and answers the stored result. */
    suspend fun update(transform: (Settings) -> Settings): Settings

    /**
     * This install's random device id (`[A-Za-z0-9_-]`, created on first
     * use and never derived from the hardware or the user). Blocks and AW
     * buckets carry it; reinstalling the app makes a new one.
     */
    suspend fun deviceId(): String
}
