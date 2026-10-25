// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import androidx.lifecycle.Lifecycle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The overlay window's own lifecycle, which Compose needs outside an Activity. */
@RunWith(RobolectricTestRunner::class)
class OverlayLifecycleOwnerTest {
    @Test
    fun the_owner_goes_created_resumed_destroyed_with_its_window() {
        val owner = OverlayLifecycleOwner()

        owner.create()
        assertEquals(Lifecycle.State.CREATED, owner.lifecycle.currentState)
        assertTrue("saved state is restored before the view attaches", owner.savedStateRegistry.isRestored)
        owner.resume()
        assertEquals(Lifecycle.State.RESUMED, owner.lifecycle.currentState)
        owner.destroy()

        assertEquals(Lifecycle.State.DESTROYED, owner.lifecycle.currentState)
    }
}
