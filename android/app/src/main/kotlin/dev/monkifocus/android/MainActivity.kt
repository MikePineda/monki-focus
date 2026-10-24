// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dev.monkifocus.android.core.ui.MonkiTheme

/** Launcher entry point; the only exported component. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            MonkiTheme {
                ScaffoldHomeScreen()
            }
        }
    }
}
