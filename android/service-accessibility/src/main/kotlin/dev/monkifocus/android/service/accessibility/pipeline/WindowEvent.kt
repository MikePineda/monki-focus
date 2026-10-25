// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/**
 * One accessibility event as the pipeline sees it: its kind, the package
 * that sent it and a monotonic reading (`SystemClock.elapsedRealtime()`).
 * The event's text and source node are never copied in here.
 */
data class WindowEvent(
    val type: WindowEventType,
    val packageName: String,
    val monotonicMs: Long,
)

/** The two event kinds the service subscribes to. */
enum class WindowEventType {
    /** `TYPE_WINDOW_STATE_CHANGED`: a new window or screen. */
    STATE_CHANGED,

    /** `TYPE_WINDOW_CONTENT_CHANGED`: arrives in bursts while a screen scrolls or plays. */
    CONTENT_CHANGED,
}
