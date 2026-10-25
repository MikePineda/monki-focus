// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.mutableStateOf
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.service.accessibility.ui.ExitAndUnlinkScreen

/**
 * Launcher entry point, always visible in the launcher (no hidden mode
 * exists). It asks for the notification permission (API 33+) as soon as it
 * opens and before protection is turned on from here, keeps the Status line
 * and the "notice is off" banner current on every resume, and opens "Exit
 * and unlink" directly when the protection notice's action asks for it
 * ([EXTRA_OPEN_EXIT]).
 */
class MainActivity : ComponentActivity() {
    private val showExit = mutableStateOf(false)
    private val status = mutableStateOf(HomeStatus(noticePermitted = true, noticeOffBanner = false))
    private var askedForNotice = false

    private val requestNotice =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            askedForNotice = true
            refreshStatus()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        showExit.value = intent?.getBooleanExtra(EXTRA_OPEN_EXIT, false) == true
        val graph = (application as MonkiApplication).graph
        val exitFlow = graph.protection.exitFlow
        refreshStatus()
        if (savedInstanceState == null && needsNoticePermission()) requestNotice.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent {
            MonkiTheme {
                if (showExit.value) {
                    ExitAndUnlinkScreen(exitFlow = exitFlow, onDone = { showExit.value = false }, onRearm = ::turnOnProtection)
                } else {
                    ScaffoldHomeScreen(
                        status = status.value,
                        onRequestNotice = ::askForNotice,
                        onTurnOnProtection = ::turnOnProtection,
                        onExitAndUnlink = { showExit.value = true },
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_OPEN_EXIT, false)) showExit.value = true
    }

    private fun refreshStatus() {
        val graph = (application as MonkiApplication).graph
        status.value =
            HomeStatus.of(
                serviceEnabled = graph.accessibilityServiceEnabled(),
                armedByUser = graph.protection.preferences.armedByUser,
                exit = graph.protection.exitFlow.state,
                noticePermitted = NotificationManagerCompat.from(this).areNotificationsEnabled(),
            )
    }

    private fun needsNoticePermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    /** The system prompt once; after a refusal (or with app notifications off) the app's notification settings. */
    private fun askForNotice() {
        if (needsNoticePermission() && !askedForNotice) {
            requestNotice.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            runCatching {
                startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
            }
        }
    }

    /**
     * "Turn on protection": the consent gate. Only once the notice can be
     * posted (the permission is asked first) is protection armed, and only
     * here: a service turned on straight from system Settings enforces
     * nothing until this ran.
     */
    private fun turnOnProtection() {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            askForNotice()
            return
        }
        (application as MonkiApplication).graph.protection.armByUser()
        runCatching { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
    }

    companion object {
        /** Opens "Exit and unlink" (the protection notice's action). */
        const val EXTRA_OPEN_EXIT = "dev.monkifocus.android.extra.OPEN_EXIT"
    }
}
