// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/**
 * Detects that the keyboard does not open in our overlay window, the known
 * risk of `TYPE_ACCESSIBILITY_OVERLAY` (plan §8, risk 2). While a prompt is
 * in the overlay, the host samples twice a second whether a text field of
 * the overlay holds the input connection (`InputMethodManager.isActive`)
 * and whether the window insets show the IME. A text field that holds the
 * input for [graceMs] without the IME ever appearing is a failure: the host
 * remembers it and moves the prompt to `GateActivity`.
 */
class ImeProbe(
    private val graceMs: Long = GRACE_MS,
) {
    private var servedSinceMs: Long? = null
    private var imeSeen = false

    /** One sample; answers true once the overlay's keyboard is judged broken. */
    fun sample(
        inputServed: Boolean,
        imeVisible: Boolean,
        nowMonotonicMs: Long,
    ): Boolean {
        if (imeVisible) imeSeen = true
        if (imeSeen) return false
        if (!inputServed) {
            servedSinceMs = null
            return false
        }
        val since = servedSinceMs ?: nowMonotonicMs.also { servedSinceMs = it }
        return nowMonotonicMs - since >= graceMs
    }

    /** A new prompt on screen: start over. */
    fun reset() {
        servedSinceMs = null
        imeSeen = false
    }

    companion object {
        const val GRACE_MS = 1_500L
    }
}
