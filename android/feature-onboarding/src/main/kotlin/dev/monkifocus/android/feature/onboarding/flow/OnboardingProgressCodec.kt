// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * [OnboardingProgress] as one line of stored text
 * (`v1|step|accepted|declined|mode|attempted,…|completed`). The disclosure
 * counts as accepted only for the [DISCLOSURE_VERSION] it was accepted in:
 * a new disclosure text is shown and agreed to again. Unreadable text
 * starts from the beginning.
 */
object OnboardingProgressCodec {
    /** Bump when the disclosure says something new (2: what statistics keep of browser pages; private tabs). */
    const val DISCLOSURE_VERSION = 2

    private const val FORMAT = "v1"
    private const val SEPARATOR = "|"
    private const val LIST_SEPARATOR = ","
    private const val FIELDS = 7

    fun encode(progress: OnboardingProgress): String =
        listOf(
            FORMAT,
            progress.step.name,
            if (progress.disclosureAccepted) DISCLOSURE_VERSION.toString() else "0",
            flag(progress.disclosureDeclined),
            progress.mode.name,
            progress.attempted.sortedBy { it.ordinal }.joinToString(LIST_SEPARATOR) { it.name },
            flag(progress.completed),
        ).joinToString(SEPARATOR)

    fun decode(text: String?): OnboardingProgress {
        val fields = text?.split(SEPARATOR) ?: return OnboardingProgress()
        if (fields.size != FIELDS || fields[0] != FORMAT) return OnboardingProgress()
        val step = OnboardingStep.entries.firstOrNull { it.name == fields[1] } ?: return OnboardingProgress()
        val mode = OnboardingMode.entries.firstOrNull { it.name == fields[4] } ?: return OnboardingProgress()
        val attempted =
            fields[5]
                .split(LIST_SEPARATOR)
                .mapNotNull { name ->
                    OnboardingStep.entries.firstOrNull { it.name == name }
                }.toSet()
        val accepted = fields[2] == DISCLOSURE_VERSION.toString()
        val progress =
            OnboardingProgress(
                step = step,
                disclosureAccepted = accepted,
                disclosureDeclined = fields[3] == "1",
                mode = mode,
                attempted = attempted,
                completed = fields[6] == "1",
            )
        // A disclosure agreed to in another version is asked again before anything after it.
        return if (!accepted && mode == OnboardingMode.PROTECTION && step.ordinal > OnboardingStep.DISCLOSURE.ordinal) {
            progress.copy(step = OnboardingStep.DISCLOSURE, completed = false)
        } else {
            progress
        }
    }

    private fun flag(value: Boolean): String = if (value) "1" else "0"
}
