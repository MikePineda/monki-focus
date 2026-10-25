// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * How a step stands: [TO_DO] (not tried), [DONE], or [DENIED]: the user
 * opened the system screen (or answered the prompt) and came back without
 * granting it, so the step shows its denied help.
 */
enum class StepStatus {
    TO_DO,
    DONE,
    DENIED,
}
