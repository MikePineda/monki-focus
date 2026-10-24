// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.gate.state.GateUiState
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "es")
class SpanishGateScreensTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show(state: GateUiState) {
        compose.setContent { MonkiTheme { GateScreen(state, GateActions(onClose = {})) } }
    }

    @Test
    fun the_pause_renders_in_spanish() {
        show(pausing(remainingSeconds = 12))

        compose.onNodeWithText("Cerrar").assertExists()
        compose.onNodeWithText("Una pausa breve antes de decidir.").assertExists()
        compose.onNodeWithTag(GateTestTags.COUNTDOWN).assertContentDescriptionEquals("Segundos restantes: 12")
    }

    @Test
    fun the_intention_prompt_renders_in_spanish() {
        show(asking(level = 2))

        compose.onNodeWithText("¿A qué vienes?").assertExists()
        compose.onNodeWithText("Continuar a example.com").assertExists()
        compose.onNodeWithText("Primero elige cuánto tiempo.").assertExists()
    }

    @Test
    fun the_timeout_card_renders_in_spanish() {
        show(timeout())

        compose.onNodeWithText("Tus 10 min para «reply to one message» terminaron.").assertExists()
        compose.onNodeWithText("Salir").assertExists()
        compose.onNodeWithText("5 min más").assertExists()
    }

    @Test
    fun the_bedtime_cover_renders_in_spanish() {
        show(bedtime(endMinuteOfDay = null))

        compose.onNodeWithText("Es hora de dormir").assertExists()
        compose.onNodeWithText("Acceso de emergencia").assertExists()
    }
}
