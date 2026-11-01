// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.app.SearchManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.service.accessibility.action.TypedAddress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

/** "Go to another site" opens only in the browser the block is in, only web pages, with no extra flags. */
@RunWith(RobolectricTestRunner::class)
class BrowserIntentTest {
    private val browser = "org.example.browser"
    private val packageManager: PackageManager = ApplicationProvider.getApplicationContext<android.content.Context>().packageManager

    private fun browserTakes(vararg actions: String) {
        val activity = ComponentName(browser, "$browser.Main")
        shadowOf(packageManager).addActivityIfNotPresent(activity)
        actions.forEach { action ->
            val filter =
                IntentFilter(action).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                    if (action == Intent.ACTION_VIEW) {
                        addCategory(Intent.CATEGORY_BROWSABLE)
                        addDataScheme("http")
                        addDataScheme("https")
                    }
                }
            shadowOf(packageManager).addIntentFilterForActivity(activity, filter)
        }
    }

    @Test
    fun a_web_address_is_an_explicit_view_of_the_browser_with_only_new_task() {
        browserTakes(Intent.ACTION_VIEW)

        val intent = BrowserIntent.of(browser, TypedAddress.Web("https://weather.example", "weather.example"), packageManager)!!

        assertEquals(Intent.ACTION_VIEW, intent.action)
        assertEquals(browser, intent.`package`)
        assertEquals("https", intent.data?.scheme)
        assertEquals("weather.example", intent.data?.host)
        assertEquals(Intent.FLAG_ACTIVITY_NEW_TASK, intent.flags)
    }

    @Test
    fun words_are_the_browser_own_web_search() {
        browserTakes(Intent.ACTION_VIEW, Intent.ACTION_WEB_SEARCH)

        val intent = BrowserIntent.of(browser, TypedAddress.Search("weather today"), packageManager)!!

        assertEquals(Intent.ACTION_WEB_SEARCH, intent.action)
        assertEquals(browser, intent.`package`)
        assertEquals("weather today", intent.getStringExtra(SearchManager.QUERY))
        assertNull("never a search URL of ours", intent.data)
        assertEquals(Intent.FLAG_ACTIVITY_NEW_TASK, intent.flags)
    }

    @Test
    fun a_browser_with_only_action_search_gets_action_search() {
        browserTakes(Intent.ACTION_VIEW, Intent.ACTION_SEARCH)

        val intent = BrowserIntent.of(browser, TypedAddress.Search("weather today"), packageManager)!!

        assertEquals(Intent.ACTION_SEARCH, intent.action)
        assertEquals(browser, intent.`package`)
    }

    @Test
    fun a_browser_that_takes_no_search_gets_no_intent_at_all() {
        browserTakes(Intent.ACTION_VIEW)

        assertNull(BrowserIntent.of(browser, TypedAddress.Search("weather today"), packageManager))
    }

    @Test
    fun another_package_never_receives_the_address() {
        browserTakes(Intent.ACTION_VIEW)

        assertNull(BrowserIntent.of("org.example.other", TypedAddress.Web("https://weather.example", "weather.example"), packageManager))
    }
}
