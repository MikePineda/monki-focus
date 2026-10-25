// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/**
 * Port: keeps the exit flow's state across process deaths (a synchronous
 * `SharedPreferences` commit on the device), so the 2-minute wait is not
 * lost and an ended protection stays ended.
 */
interface ExitFlowStore {
    fun load(): ExitFlowState

    fun save(state: ExitFlowState)
}
