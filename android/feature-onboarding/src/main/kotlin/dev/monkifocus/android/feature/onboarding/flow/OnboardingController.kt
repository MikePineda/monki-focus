// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * Runs [OnboardingStateMachine] against its [store]: every transition is
 * saved before its effect is handed back, so a process killed while Settings
 * is open resumes on the same step. Main thread only.
 */
class OnboardingController(
    private val store: OnboardingStore,
) {
    var progress: OnboardingProgress = store.load()
        private set

    /** Applies [event] with the permissions as they are now; answers what the platform must do. */
    fun handle(
        event: OnboardingEvent,
        snapshot: SetupSnapshot,
    ): OnboardingEffect? {
        val transition = OnboardingStateMachine.reduce(progress, event, snapshot)
        update(transition.progress)
        return transition.effect
    }

    /** Onboarding again from its first missing required step (see [OnboardingStateMachine.restart]). */
    fun restart(snapshot: SetupSnapshot) {
        update(OnboardingStateMachine.restart(progress, snapshot))
    }

    private fun update(next: OnboardingProgress) {
        if (next == progress) return
        progress = next
        store.save(next)
    }
}
