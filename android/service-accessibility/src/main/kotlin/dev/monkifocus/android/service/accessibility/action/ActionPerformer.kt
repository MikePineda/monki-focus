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

    /**
     * True only while what was last shown is really in front: the overlay
     * window attached, or `GateActivity` started. The pipeline shows again
     * whenever this is false, so leaving the activity with HOME and
     * reopening the app never dodges the gate.
     */
    fun isOnTop(): Boolean

    /**
     * Opens [address] in [browserPackage], the browser the blocked page is
     * in, with an explicit intent (never another app). The engine already
     * let a [TypedAddress.Web] through; a search is the browser's own.
     */
    fun open(
        browserPackage: String,
        address: TypedAddress,
    )

    /** Opens our app, or with [notificationSettings] its notification settings. */
    fun openApp(notificationSettings: Boolean)
}
