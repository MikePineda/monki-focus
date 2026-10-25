// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import dev.monkifocus.android.service.accessibility.action.OverlayContent

/**
 * Our one overlay window (plan §2.5): `TYPE_ACCESSIBILITY_OVERLAY`, added
 * through the accessibility service's own `WindowManager`, hosting a
 * `ComposeView` with its own [OverlayLifecycleOwner].
 *
 * - Gate, block, bedtime and bounce screens fill the screen and take every
 *   touch on it; they are `FLAG_NOT_FOCUSABLE` (keys and the IME stay with
 *   the app below) except a prompt with a text field, which needs focus;
 * - the hide-feed cover is only as tall as its region, so the bars around it
 *   (URL bar, tab bar) keep working, and it never takes focus.
 *
 * The window is created once and its content and layout updated in place.
 * Main thread only.
 */
internal class OverlayHost(
    private val service: AccessibilityService,
    private val render: @Composable (OverlayContent) -> Unit,
) {
    private val windowManager: WindowManager = service.getSystemService(WindowManager::class.java)
    private val content = mutableStateOf<OverlayContent?>(null)
    private var view: ComposeView? = null
    private var owner: OverlayLifecycleOwner? = null
    private var params: WindowManager.LayoutParams? = null

    /** The overlay's root view while it is shown (for the IME probe). */
    val rootView: View? get() = view

    /**
     * True while our window has been added and not removed. An accessibility
     * overlay always sits above the app, so an added window is on top.
     */
    val attached: Boolean get() = view != null

    fun show(
        next: OverlayContent,
        focusable: Boolean,
    ) {
        content.value = next
        val wanted = paramsFor(next, focusable)
        val current = view
        if (current == null) {
            attach(wanted)
        } else if (!sameLayout(params, wanted)) {
            windowManager.updateViewLayout(current, wanted)
            params = wanted
        }
    }

    fun clear() {
        val current = view ?: return
        runCatching { windowManager.removeViewImmediate(current) }
        owner?.destroy()
        view = null
        owner = null
        params = null
        content.value = null
    }

    private fun attach(wanted: WindowManager.LayoutParams) {
        val lifecycle = OverlayLifecycleOwner().apply { create() }
        val compose =
            ComposeView(service).apply {
                setViewTreeLifecycleOwner(lifecycle)
                setViewTreeSavedStateRegistryOwner(lifecycle)
                setViewTreeViewModelStoreOwner(lifecycle)
                setContent { content.value?.let { render(it) } }
            }
        windowManager.addView(compose, wanted)
        lifecycle.resume()
        view = compose
        owner = lifecycle
        params = wanted
    }

    private fun paramsFor(
        next: OverlayContent,
        focusable: Boolean,
    ): WindowManager.LayoutParams {
        val region = (next as? OverlayContent.Cover)?.region
        val height = region?.let { (it.bottom - it.top).coerceAtLeast(1) } ?: WindowManager.LayoutParams.MATCH_PARENT
        var flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        if (!focusable || region != null) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        return WindowManager
            .LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                height,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                flags,
                PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                y = region?.top ?: 0
                softInputMode =
                    if (focusable) {
                        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                    } else {
                        WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED
                    }
            }
    }

    private fun sameLayout(
        a: WindowManager.LayoutParams?,
        b: WindowManager.LayoutParams,
    ): Boolean = a != null && a.height == b.height && a.y == b.y && a.flags == b.flags && a.softInputMode == b.softInputMode
}
