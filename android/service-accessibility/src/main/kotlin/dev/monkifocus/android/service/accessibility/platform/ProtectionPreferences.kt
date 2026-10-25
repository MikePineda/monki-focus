// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.exit.ExitFlowStore

/**
 * The small state the protection keeps outside Room, written synchronously
 * (`commit`) so it survives the process being torn down right after:
 *
 * - the exit flow's state ([ExitFlowStore]);
 * - the bypass journal: events not yet confirmed in the Room outbox, one
 *   `BypassJournalCodec` line each (codes and instants only), written from
 *   the main and the IO thread, hence synchronised;
 * - whether the overlay's keyboard failed the IME probe on this device.
 *
 * Backups are off for the whole app (`allowBackup=false`).
 */
class ProtectionPreferences(
    context: Context,
) : ExitFlowStore {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override fun load(): ExitFlowState {
        val at = prefs.getLong(KEY_EXIT_AT, 0L)
        return when (prefs.getString(KEY_EXIT_STATE, null)) {
            STATE_WAITING -> ExitFlowState.Waiting(at, prefs.getInt(KEY_EXIT_BOOT, 0))
            STATE_ENDED -> ExitFlowState.Ended(at, prefs.getBoolean(KEY_REARM_ALLOWED, false))
            else -> ExitFlowState.Armed
        }
    }

    override fun save(state: ExitFlowState) {
        prefs.edit(commit = true) {
            when (state) {
                ExitFlowState.Armed -> {
                    remove(KEY_EXIT_STATE)
                    remove(KEY_EXIT_AT)
                    remove(KEY_EXIT_BOOT)
                    remove(KEY_REARM_ALLOWED)
                }

                is ExitFlowState.Waiting -> {
                    putString(KEY_EXIT_STATE, STATE_WAITING)
                    putLong(KEY_EXIT_AT, state.requestedAtMs)
                    putInt(KEY_EXIT_BOOT, state.boot)
                }

                is ExitFlowState.Ended -> {
                    putString(KEY_EXIT_STATE, STATE_ENDED)
                    putLong(KEY_EXIT_AT, state.endedAtMs)
                    putBoolean(KEY_REARM_ALLOWED, state.rearmAllowed)
                }
            }
        }
    }

    fun journal(): Set<String> = prefs.getStringSet(KEY_JOURNAL, emptySet()).orEmpty().toSet()

    @Synchronized
    fun addToJournal(line: String) {
        prefs.edit(commit = true) { putStringSet(KEY_JOURNAL, journal() + line) }
    }

    @Synchronized
    fun removeFromJournal(line: String) {
        prefs.edit(commit = true) { putStringSet(KEY_JOURNAL, journal() - line) }
    }

    var overlayImeFailed: Boolean
        get() = prefs.getBoolean(KEY_OVERLAY_IME_FAILED, false)
        set(value) = prefs.edit(commit = true) { putBoolean(KEY_OVERLAY_IME_FAILED, value) }

    private companion object {
        const val FILE = "monki_protection"
        const val KEY_EXIT_STATE = "exit_state"
        const val KEY_EXIT_AT = "exit_at_ms"
        const val KEY_EXIT_BOOT = "exit_boot"
        const val KEY_REARM_ALLOWED = "exit_rearm_allowed"
        const val KEY_JOURNAL = "bypass_journal"
        const val KEY_OVERLAY_IME_FAILED = "overlay_ime_failed"
        const val STATE_WAITING = "waiting"
        const val STATE_ENDED = "ended"
    }
}
