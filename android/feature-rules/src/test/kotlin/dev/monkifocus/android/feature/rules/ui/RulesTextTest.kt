// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.rules.support.RulesData
import org.junit.Assert.assertEquals
import org.junit.Test

class RulesTextTest {
    @Test
    fun every_registered_surface_has_a_catalog_label() {
        val unlabelled = RulesData.surfaceIds.filter { RulesText.surfaceLabel(it) == null }

        assertEquals(emptyList<String>(), unlabelled)
    }

    @Test
    fun facebook_surfaces_have_catalog_labels() {
        val facebook = RulesData.surfaceIds.filter { it.startsWith("facebook.") }

        assertEquals(10, facebook.size)
        assertEquals(R.string.surface_facebook_reels, RulesText.surfaceLabel("facebook.reels"))
        assertEquals(R.string.surface_facebook_watch, RulesText.surfaceLabel("facebook.watch"))
    }
}
