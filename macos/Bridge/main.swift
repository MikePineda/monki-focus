// SPDX-License-Identifier: AGPL-3.0-or-later

// monki-bridge: the native messaging host the browser extension starts
// (`dev.monkifocus.bridge`). It lives at `MonkiFocus.app/Contents/Helpers/`
// and relays between the browser (framed stdio) and the app's Unix socket
// (NDJSON); see BridgeRelay. It never logs or stores what it relays.

BridgeRelay.run()
