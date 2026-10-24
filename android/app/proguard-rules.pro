# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Release builds drop every android.util.Log call, so nothing written for
# debugging (and never node text, see scripts/ci/check-android-logging.sh)
# reaches logcat on a user's device. The methods are listed instead of
# `{ *; }` so the rule cannot match members inherited from java.lang.Object.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
    public static int wtf(...);
    public static int println(...);
}
