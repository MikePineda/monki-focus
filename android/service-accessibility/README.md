# `:service-accessibility`

The accessibility service, its overlay and the anti-bypass guard (plan WP 2.7).
Everything that decides is pure Kotlin and tested on the JVM; the Android
classes under `platform/` and the Compose screens under `ui/` are thin.

## Flow of one event

```
AccessibilityEvent ─► MonkiAccessibilityService (platform, thin)
   └─► EventPipeline (pure)
         ReadThrottle        content bursts: one read per 250 ms per package,
                             the burst's last screen flushed afterwards
         ScreenObserver      settings pack → AntiBypassGuard
                             browser pack  → BrowserUrlExtractor → UrlKey (host + first segment + surface)
                             app packs     → SurfaceClassifier → DmReelSession
         UnclassifiedTimeCap fed on every read and every 30 s tick
         DecisionThrottle    the engine runs on a new target or after 1 s
         DecisionEvaluator   decide(…, instantOf(System.currentTimeMillis()), catalog), fail closed
         ActionSelector      back · gate · cover · clear
         GateCoordinator     effectiveEscalationState + nextEscalation, persisted through ports
   └─► ActionPerformer (platform): GLOBAL_ACTION_BACK/HOME, OverlayHost, GateActivity
```

`onTick` moves what time moves: pauses, emergency waits (always granted and
recorded), intentions, the exit wait, the cap's window, and leaving a watched
app (the service only gets events of its `packageNames`, so the package of the
active window is polled once a second while an overlay is up).

## Decisions

- **Explicit `packageNames`** (threat model): the packs' packages, Settings and
  the package installers. Bedtime is therefore enforced on those packages
  only; other apps are not watched at all.
- **Surface block → BACK**, then a dismissible notice that still offers
  emergency access; two BACKs within 1.5 s that do not leave the surface →
  HOME.
- **Hide-feed in browsers → cover, not BACK.** BACK from a home page opened
  fresh leaves the browser; the cover sits between the URL bar and the bottom
  bars (`keepVisible`), so typing a URL or opening a permalink stays one tap
  away. Permalinks never get a cover (the engine shows them). A focused URL
  bar removes the cover and is not read; an absent one changes nothing.
- **Overlay first, `GateActivity` as fallback.** Every screen starts in the
  `TYPE_ACCESSIBILITY_OVERLAY` window. A prompt that requires a typed
  intention moves to `GateActivity` when the overlay keyboard cannot be
  trusted: on API 29 (insets cannot report the IME) or once the `ImeProbe`
  saw a text field hold the input for 1.5 s with no keyboard. The failure is
  remembered per device.
- **Engine error** blocks with Close only (nothing lifts it); the way out is
  "Exit and unlink", which never asks the engine.
- **Unclassified cap**: when it applies, `decide` runs with one extra
  `friction` rule on the package (`unclassified-cap-<package>`), so bedtime,
  unlocks and escalation work as for any rule.
- **No rule set stored yet** → the bundled starter preset in the device zone.
  Storage unreadable → fail closed.
- **Downloaded packs** are re-verified on every start from
  `noBackupFilesDir/detector-packs/`; no `rules-signing` key is pinned yet, so
  every download is refused and the bundled packs stay active.

## Anti-stalkerware (plan 04 §2)

- **Never a silent block**: our App info, uninstall, device-admin and
  accessibility-detail screens get a card with "Go back" and "Disable
  protection (waits 2 min, …)". A label collision (another installed package
  or active admin named like us; unreadable admin labels count) releases the
  App info, uninstall and device-admin guards.
- **Exit and unlink** (home screen, notice action, every bounce card): 2-minute
  wait → neutral `protection_ended` event → device admin removed → overlays
  and notice gone → `disableSelf()`. Turning the service on again re-arms it.
- **Persistent notice** while protection is active, posted again when
  dismissed. Android 14+ lets users swipe away ongoing notifications of apps
  without a foreground service; no foreground service is used: the
  `deleteIntent` and every tick post it again.
- **Bypass events** (`accessibility_disabled` on unbind/interrupt,
  `device_admin_disabled` outside the exit, `emergency_override`) are written
  to a synchronous journal before the Room outbox, so one recorded while the
  process dies is queued on the next start.
- Launcher icon always present; no hidden mode exists in code. ADB remains a
  documented exit: `adb shell dpm remove-active-admin dev.monkifocus.android/.MonkiDeviceAdminReceiver`.

## Privacy

Node text is compared in memory only. The URL bar text lives for the one
`decide` call of its event; the pipeline keeps a `UrlKey`. This module logs
nothing at all (`AccessibilityTextIsNeverLoggedTest`) and requests no
permission.

## Tests

The pure tests run on the JVM (`testDebugUnitTest` in CI): pipeline
throttling, cap feeding, URL-bar skipping, action selection, DM reels with the
synthetic dumps, the guard and label collisions, the exit flow (with an
engine error), the notice, bypass journalling and pack loading.
Robolectric covers the wiring: the service binding, unbinding and re-arming,
and the overlay lifecycle owner.

## To validate on a device (WP 2.12)

Service listing and binding; IME in the overlay vs `GateActivity` on API 36/37;
`GateActivity` launch from the service; overlay touch and cover placement
against real bars; Reels → BACK, DM reel open, Shorts → BACK; reddit cover on
the home page and none on permalinks; the gate escalating 5 → 15 → typed;
the bounce card on every guarded screen in the device's language; the notice
coming back after a swipe on Android 14+; the exit flow end to end; OEM
battery killers.
