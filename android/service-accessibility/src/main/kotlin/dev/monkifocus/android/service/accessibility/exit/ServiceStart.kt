// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** What the accessibility service does when the system binds it. */
enum class ServiceStart {
    /** Protection is armed (or a running exit wait continues): enforce. */
    RUN,

    /** Protection was ended by "Exit and unlink" and the user did not bring it back from our app: turn off again. */
    DISABLE,
}
