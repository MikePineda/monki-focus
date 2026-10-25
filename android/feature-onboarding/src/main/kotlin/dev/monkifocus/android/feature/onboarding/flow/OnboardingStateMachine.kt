// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.ACCESSIBILITY
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.BATTERY
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.DEVICE_ADMIN
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.DISCLOSURE
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.NOTIFICATIONS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.RESTRICTED_SETTINGS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.TURN_ON
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.USAGE_ACCESS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.WELCOME

/**
 * The onboarding flow, pure: every transition takes the stored progress, the
 * user's event and the permissions as they really are now ([SetupSnapshot],
 * read again on every resume). Rules it guarantees, each with its test:
 *
 * - no system screen (prompt or Settings) opens before the accessibility
 *   disclosure is accepted, and with statistics only nothing but usage
 *   access does;
 * - a required step (disclosure, notifications, accessibility) cannot be
 *   left forward until it is done; optional ones can be skipped;
 * - [OnboardingEffect.Arm] comes only from the last step and only while
 *   every required step is done: `armedByUser` is set after all of them.
 */
object OnboardingStateMachine {
    private val REQUIRED = listOf(DISCLOSURE, NOTIFICATIONS, ACCESSIBILITY)
    private val STATS_ONLY_PATH = listOf(WELCOME, DISCLOSURE, USAGE_ACCESS, TURN_ON)
    private val SYSTEM_SCREENS = setOf(RESTRICTED_SETTINGS, NOTIFICATIONS, ACCESSIBILITY, USAGE_ACCESS, BATTERY, DEVICE_ADMIN)

    /** The steps the user walks through, in order. */
    fun path(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): List<OnboardingStep> =
        when (progress.mode) {
            OnboardingMode.STATS_ONLY -> {
                STATS_ONLY_PATH
            }

            OnboardingMode.PROTECTION -> {
                OnboardingStep.entries.filter {
                    it != RESTRICTED_SETTINGS || (snapshot.restrictedSettings.mayBlock && !snapshot.accessibilityService)
                }
            }
        }

    fun isRequired(
        step: OnboardingStep,
        mode: OnboardingMode,
    ): Boolean = mode == OnboardingMode.PROTECTION && step in REQUIRED

    fun status(
        step: OnboardingStep,
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): StepStatus =
        when (step) {
            WELCOME -> {
                StepStatus.DONE
            }

            DISCLOSURE -> {
                when {
                    progress.disclosureAccepted -> StepStatus.DONE
                    progress.disclosureDeclined -> StepStatus.DENIED
                    else -> StepStatus.TO_DO
                }
            }

            RESTRICTED_SETTINGS -> {
                granted(!snapshot.restrictedSettings.mayBlock || snapshot.accessibilityService, step, progress)
            }

            NOTIFICATIONS -> {
                granted(snapshot.notifications, step, progress)
            }

            ACCESSIBILITY -> {
                granted(snapshot.accessibilityService, step, progress)
            }

            USAGE_ACCESS -> {
                granted(snapshot.usageAccess, step, progress)
            }

            BATTERY -> {
                granted(snapshot.batteryUnrestricted, step, progress)
            }

            DEVICE_ADMIN -> {
                granted(snapshot.deviceAdmin, step, progress)
            }

            TURN_ON -> {
                if (progress.completed) StepStatus.DONE else StepStatus.TO_DO
            }
        }

    /** Required steps that are not done yet, in order (empty: protection can be turned on). */
    fun missing(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): List<OnboardingStep> = REQUIRED.filter { isRequired(it, progress.mode) && status(it, progress, snapshot) != StepStatus.DONE }

    /** Whether Next may leave the current step. */
    fun canAdvance(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): Boolean = !isRequired(progress.step, progress.mode) || status(progress.step, progress, snapshot) == StepStatus.DONE

    fun reduce(
        progress: OnboardingProgress,
        event: OnboardingEvent,
        snapshot: SetupSnapshot,
    ): OnboardingTransition =
        when (event) {
            OnboardingEvent.Next -> {
                OnboardingTransition(if (canAdvance(progress, snapshot)) progress.copy(step = next(progress, snapshot)) else progress)
            }

            OnboardingEvent.Back -> {
                OnboardingTransition(progress.copy(step = previous(progress, snapshot)))
            }

            OnboardingEvent.AcceptDisclosure -> {
                val agreed =
                    progress.copy(
                        disclosureAccepted = true,
                        disclosureDeclined = false,
                        mode = OnboardingMode.PROTECTION,
                        step = DISCLOSURE,
                    )
                OnboardingTransition(agreed.copy(step = next(agreed, snapshot)))
            }

            OnboardingEvent.DeclineDisclosure -> {
                OnboardingTransition(progress.copy(disclosureAccepted = false, disclosureDeclined = true, step = DISCLOSURE))
            }

            OnboardingEvent.ContinueStatsOnly -> {
                if (!progress.disclosureDeclined) {
                    OnboardingTransition(progress)
                } else {
                    OnboardingTransition(progress.copy(mode = OnboardingMode.STATS_ONLY, step = USAGE_ACCESS))
                }
            }

            is OnboardingEvent.Act -> {
                act(progress, event.step)
            }

            is OnboardingEvent.GoTo -> {
                OnboardingTransition(progress.copy(step = reachable(progress, snapshot, event.step)))
            }

            OnboardingEvent.Finish -> {
                finish(progress, snapshot)
            }
        }

    /**
     * Onboarding again after it ended (protection off, an exit, a revoked
     * permission, statistics only): the protection path from its first
     * missing required step, with the denied help reset.
     */
    fun restart(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): OnboardingProgress {
        val fresh = progress.copy(completed = false, mode = OnboardingMode.PROTECTION, disclosureDeclined = false, attempted = emptySet())
        return fresh.copy(step = missing(fresh, snapshot).firstOrNull() ?: TURN_ON)
    }

    private fun granted(
        done: Boolean,
        step: OnboardingStep,
        progress: OnboardingProgress,
    ): StepStatus =
        when {
            done -> StepStatus.DONE
            step in progress.attempted -> StepStatus.DENIED
            else -> StepStatus.TO_DO
        }

    private fun mayOpen(
        progress: OnboardingProgress,
        step: OnboardingStep,
    ): Boolean =
        step in SYSTEM_SCREENS &&
            when (progress.mode) {
                OnboardingMode.PROTECTION -> progress.disclosureAccepted
                OnboardingMode.STATS_ONLY -> progress.disclosureDeclined && step == USAGE_ACCESS
            }

    private fun act(
        progress: OnboardingProgress,
        step: OnboardingStep,
    ): OnboardingTransition {
        if (!mayOpen(progress, step)) return OnboardingTransition(progress)
        return OnboardingTransition(progress.copy(attempted = progress.attempted + step), OnboardingEffect.Open(step))
    }

    private fun finish(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): OnboardingTransition {
        if (progress.step != TURN_ON) return OnboardingTransition(progress)
        return when (progress.mode) {
            OnboardingMode.STATS_ONLY -> {
                OnboardingTransition(progress.copy(completed = true), OnboardingEffect.FinishStatsOnly)
            }

            OnboardingMode.PROTECTION -> {
                if (missing(progress, snapshot).isNotEmpty()) {
                    OnboardingTransition(progress)
                } else {
                    OnboardingTransition(progress.copy(completed = true), OnboardingEffect.Arm)
                }
            }
        }
    }

    /** [target], or the disclosure while it is not accepted: nothing after it is reachable before. */
    private fun reachable(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
        target: OnboardingStep,
    ): OnboardingStep {
        if (target !in path(progress, snapshot)) return progress.step
        val disclosurePending = status(DISCLOSURE, progress, snapshot) != StepStatus.DONE && progress.mode == OnboardingMode.PROTECTION
        return if (disclosurePending && target.ordinal > DISCLOSURE.ordinal) DISCLOSURE else target
    }

    private fun next(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): OnboardingStep = path(progress, snapshot).firstOrNull { it.ordinal > progress.step.ordinal } ?: progress.step

    private fun previous(
        progress: OnboardingProgress,
        snapshot: SetupSnapshot,
    ): OnboardingStep = path(progress, snapshot).lastOrNull { it.ordinal < progress.step.ordinal } ?: progress.step
}
