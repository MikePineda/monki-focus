// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.guard

import dev.monkifocus.android.service.accessibility.guard.LabelCollision.Labelled
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LabelCollisionTest {
    private val ours = "dev.monkifocus.android"
    private val labels = setOf("monki-focus")

    private fun exists(
        installed: List<Labelled> = emptyList(),
        admins: List<Labelled> = emptyList(),
    ) = LabelCollision.exists(labels, ours, installed, admins)

    @Test
    fun our_own_package_is_no_collision() {
        assertFalse(exists(installed = listOf(Labelled(ours, "monki-focus")), admins = listOf(Labelled(ours, "monki-focus"))))
    }

    @Test
    fun another_installed_package_with_our_label_is_a_collision() {
        assertTrue(exists(installed = listOf(Labelled("com.example.lookalike", " monki-focus "))))
    }

    @Test
    fun another_active_admin_with_our_label_is_a_collision() {
        assertTrue(exists(admins = listOf(Labelled("com.example.lookalike", "monki-focus"))))
    }

    @Test
    fun an_active_admin_whose_label_cannot_be_read_counts_as_a_collision() {
        assertTrue(exists(admins = listOf(Labelled("com.example.hidden", null))))
    }

    @Test
    fun differently_named_apps_are_no_collision() {
        assertFalse(exists(installed = listOf(Labelled("com.example.other", "Monki Focus Pro"), Labelled("com.example.blank", null))))
    }
}
