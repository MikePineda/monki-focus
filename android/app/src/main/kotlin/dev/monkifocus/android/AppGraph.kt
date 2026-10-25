// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Application
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.view.accessibility.AccessibilityManager
import androidx.work.WorkManager
import dev.monkifocus.android.background.bedtime.BedtimeWarningRun
import dev.monkifocus.android.background.ingest.AndroidBuckets
import dev.monkifocus.android.background.ingest.BlockAggregation
import dev.monkifocus.android.background.ingest.UsageIngest
import dev.monkifocus.android.background.packs.LoaderStoredPackCheck
import dev.monkifocus.android.background.packs.StoredPackCheck
import dev.monkifocus.android.background.packs.StoredPackFiles
import dev.monkifocus.android.background.web.KnownSections
import dev.monkifocus.android.background.web.WebHeartbeatRecorder
import dev.monkifocus.android.background.work.BackgroundDependencies
import dev.monkifocus.android.background.work.BackgroundScheduler
import dev.monkifocus.android.core.data.CoreDataGraph
import dev.monkifocus.android.core.data.usage.AppOpsUsageAccess
import dev.monkifocus.android.core.data.usage.UsageAccess
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.feature.onboarding.flow.OnboardingController
import dev.monkifocus.android.feature.onboarding.platform.SharedPreferencesOnboardingStore
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.stats.model.StatsLoader
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier
import dev.monkifocus.android.service.accessibility.pipeline.UrlKey
import dev.monkifocus.android.service.accessibility.platform.MonkiAccessibilityService
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraph
import dev.monkifocus.android.service.accessibility.platform.ProtectionInputs
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.File
import java.time.Clock
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Composition root (manual DI): constructor injection, one `lazy` per
 * singleton, an interface per domain port. The only place that touches the
 * system clock; domain code receives it as a parameter.
 */
class AppGraph(
    val application: Application,
) {
    val wallClock: Clock by lazy { Clock.systemUTC() }

    val data: CoreDataGraph by lazy { CoreDataGraph(application) }

    val rules: BundledRules by lazy { BundledRules(application.assets) }

    private val systemNotifier: ProtectionNotifier by lazy { SystemProtectionNotifier(application) }

    val notifier: ProtectionNotifier get() = systemNotifier

    /**
     * Downloaded detector packs are verified against the pinned
     * `rules-signing` key. No key is pinned in this build yet, so every
     * download is refused and the bundled packs stay active.
     */
    private val packVerifier = SignatureVerifier { _, _ -> false }

    val protection: ProtectionGraph by lazy { ProtectionGraph(application, Inputs()) }

    private val detectorPackLoader: DetectorPackLoader by lazy {
        DetectorPackLoader(rules.validator, packVerifier, rules.surfaces.map { it.id }.toSet())
    }

    /** Whether the user grants usage access right now (Settings › Usage access). */
    val usageAccess: UsageAccess by lazy { AppOpsUsageAccess(application) }

    /** This device's ActivityWatch buckets (foreground apps, away periods, browser pages). */
    private val analyticsBuckets: AndroidBuckets by lazy { AndroidBuckets(created = instantOf(wallClock.millis())) }

    /** Usage events → sessions → 5-minute blocks, run by `UsageIngestWorker`. */
    val usageIngest: UsageIngest by lazy {
        UsageIngest(
            source = data.usageEvents,
            cursors = data.ingestCursors,
            store = data.activityEvents,
            aggregation =
                BlockAggregation(
                    store = data.activityEvents,
                    blocks = data.blocks,
                    cursors = data.ingestCursors,
                    buckets = analyticsBuckets,
                    catalog = rules.catalog,
                    deviceId = { data.settings.deviceId() },
                    categories = { now -> analyticsRuleset(now).categories.also(knownSections::update) },
                    browserApps = ::browserPackages,
                ),
        )
    }

    /**
     * The first path segments the statistics may keep: those the bundled site
     * profiles or a category path rule name. Refreshed with the user's rules on
     * every ingest and when the recorder starts.
     */
    private val knownSections: KnownSections by lazy { KnownSections(rules.catalog) }

    /** URL-bar readings of the accessibility service → `web.tab.current` heartbeats (domain, known section only). */
    private val webHeartbeats: WebHeartbeatRecorder by lazy {
        protection.io.launch { knownSections.update(analyticsRuleset(instantOf(wallClock.millis())).categories) }
        WebHeartbeatRecorder(
            store = data.activityEvents,
            bucket = analyticsBuckets.web,
            scope = protection.io,
            knownSection = knownSections::allows,
        )
    }

    /** Every background job (WorkManager unique work, no exact alarms). */
    val background: BackgroundScheduler by lazy { BackgroundScheduler(WorkManager.getInstance(application)) }

    /** What `MonkiWorkerFactory` builds the workers with. */
    val workers: BackgroundDependencies by lazy { Workers(wallClock, usageIngest) }

    /** The local statistics, read in the rule set's pinned zone. */
    val stats: StatsLoader by lazy {
        StatsLoader(data.blocks, data.intentions, { usageAccess.isGranted() }) { now -> analyticsRuleset(now).timeZone }
    }

    /**
     * The rule set analytics reads (categories, pinned zone, bedtime): the
     * stored one in force, or the bundled starter when none is stored or it
     * cannot be read. Statistics never fail because of the rules.
     */
    private suspend fun analyticsRuleset(now: String): Ruleset =
        try {
            data.rulesets.active(now)?.ruleset ?: rules.starter
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            rules.starter
        }

    /** Packages of the device's browsers: whatever opens an http link (as the accessibility service resolves them). */
    private fun browserPackages(): Set<String> {
        val view = Intent(Intent.ACTION_VIEW, Uri.parse(BROWSER_PROBE_URL)).addCategory(Intent.CATEGORY_BROWSABLE)
        val packageManager = application.packageManager
        val found =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.queryIntentActivities(view, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()))
            } else {
                @Suppress("DEPRECATION")
                packageManager.queryIntentActivities(view, PackageManager.MATCH_ALL)
            }
        return found.mapNotNull { it.activityInfo?.packageName }.toSet()
    }

    /** The only way the app changes the rule set: tighten now, loosen later (SEMANTICS.md §8). */
    val ruleChanges: RuleChangeService by lazy {
        RuleChangeService(data.rulesets, rules.catalog, RulesetCheck.of(rules.validator), { rules.starter }, wallClock)
    }

    /** Onboarding progress, resumed across process deaths. */
    val onboarding: OnboardingController by lazy { OnboardingController(SharedPreferencesOnboardingStore(application)) }

    /** Our accessibility service, as Settings names it. */
    val accessibilityService: ComponentName get() = ComponentName(application, MonkiAccessibilityService::class.java)

    /** Our device-admin receiver (uninstall friction only). */
    val deviceAdminReceiver: ComponentName get() = ComponentName(application, MonkiDeviceAdminReceiver::class.java)

    /** Whether the user has our accessibility service turned on in Settings. */
    fun accessibilityServiceEnabled(): Boolean {
        val manager = application.getSystemService(AccessibilityManager::class.java) ?: return false
        val ours = accessibilityService
        return manager
            .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any { ComponentName.unflattenFromString(it.id) == ours }
    }

    private inner class Inputs : ProtectionInputs {
        override val catalog: RulesCatalog get() = rules.catalog

        override val packLoader: DetectorPackLoader get() = detectorPackLoader

        override fun bundledPacks(): Map<String, ByteArray> = rules.packs()

        override fun starterRuleset(): Ruleset = rules.starter

        override suspend fun activeRuleset(now: String): Ruleset = data.rulesets.active(now)?.ruleset ?: rules.starter

        override val escalationStates: EscalationStateRepository get() = data.escalationStates
        override val intentions: IntentionRepository get() = data.intentions
        override val bypassOutbox: BypassEventOutbox get() = data.bypassEvents
        override val notifier: ProtectionNotifier get() = systemNotifier
        override val deviceAdmin: ComponentName get() = deviceAdminReceiver
        override val ownLabels: Set<String> get() = setOf(application.getString(CoreUiR.string.app_name))

        override fun siteSeen(
            key: UrlKey,
            nowEpochMs: Long,
        ) {
            webHeartbeats.siteSeen(key, nowEpochMs)
        }
    }

    private inner class Workers(
        override val wallClock: Clock,
        override val usageIngest: UsageIngest,
    ) : BackgroundDependencies {
        override val bedtimeWarning: BedtimeWarningRun by lazy {
            BedtimeWarningRun({ now -> analyticsRuleset(now) }, data.ingestCursors, SystemBedtimeWarningNotifier(application))
        }

        override val storedPacks: StoredPackCheck by lazy {
            LoaderStoredPackCheck(
                loader = detectorPackLoader,
                bundled = { rules.packs() },
                stored = StoredPackFiles(File(application.noBackupFilesDir, StoredPackFiles.DIRECTORY)),
            )
        }
    }

    private companion object {
        /** Any http URL: the browsers are the apps that open it. */
        const val BROWSER_PROBE_URL = "http://example.org/"
    }
}
