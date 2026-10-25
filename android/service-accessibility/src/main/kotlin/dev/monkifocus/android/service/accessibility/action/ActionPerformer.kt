// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/**
 * Port: what the pipeline makes the device do. On the device the service
 * implements it with `performGlobalAction` and the overlay host; tests
 * record the calls.
 */
interface ActionPerformer {
    /** `GLOBAL_ACTION_BACK`. */
    fun back()

    /** `GLOBAL_ACTION_HOME`. */
    fun home()

    /** Shows [content] in our overlay, replacing whatever it showed. */
    fun show(content: OverlayContent)

    /** Removes our overlay. */
    fun clear()
}
