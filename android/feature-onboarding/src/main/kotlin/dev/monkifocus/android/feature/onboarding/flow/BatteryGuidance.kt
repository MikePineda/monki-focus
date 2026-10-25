// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * The battery-saver advice for the device's maker (`Build.MANUFACTURER`),
 * summarised from dontkillmyapp.com: several OEMs stop background services
 * beyond what Android's own battery optimisation does. [steps] names the
 * family whose instructions the screen shows; [url] is the matching
 * dontkillmyapp.com page, opened in the browser only when the user asks.
 */
enum class BatteryGuidance(
    val url: String,
) {
    SAMSUNG("https://dontkillmyapp.com/samsung"),
    XIAOMI("https://dontkillmyapp.com/xiaomi"),
    HUAWEI("https://dontkillmyapp.com/huawei"),
    ONEPLUS("https://dontkillmyapp.com/oneplus"),
    OPPO("https://dontkillmyapp.com/oppo"),
    REALME("https://dontkillmyapp.com/realme"),
    VIVO("https://dontkillmyapp.com/vivo"),
    GENERIC("https://dontkillmyapp.com/"),
    ;

    /** Which instruction text applies: OPPO, OnePlus and realme share ColorOS settings. */
    val steps: BatteryGuidance
        get() =
            when (this) {
                ONEPLUS, OPPO, REALME -> OPPO
                else -> this
            }

    companion object {
        private val BY_MAKER =
            mapOf(
                "samsung" to SAMSUNG,
                "xiaomi" to XIAOMI,
                "redmi" to XIAOMI,
                "poco" to XIAOMI,
                "huawei" to HUAWEI,
                "honor" to HUAWEI,
                "oneplus" to ONEPLUS,
                "oppo" to OPPO,
                "realme" to REALME,
                "vivo" to VIVO,
                "iqoo" to VIVO,
            )

        fun forManufacturer(manufacturer: String?): BatteryGuidance = BY_MAKER[manufacturer.orEmpty().trim().lowercase()] ?: GENERIC
    }
}
