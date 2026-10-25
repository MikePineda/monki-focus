# Changelog

## 1.0.0 (2026-10-25)


### Added

* **macos:** add the monki-bridge relay, the app socket server and the host manifest installer ([6cfaf41](https://github.com/MikePineda/monki-focus/commit/6cfaf411f72818f138d7dabb4d024fe12f93780f))
* **macos:** add the window and afk watchers, heartbeat queue and grdb event store ([b0bf66f](https://github.com/MikePineda/monki-focus/commit/b0bf66f463d405a030cdfd25240ee8270e992768))
* **macos:** port the analytics core to MonkiCore ([b96e2ff](https://github.com/MikePineda/monki-focus/commit/b96e2ff62d2dff18be05df86d02a48557a9ab11f))
* **macos:** port the decision engine to MonkiCore ([ff6389a](https://github.com/MikePineda/monki-focus/commit/ff6389aa5058a4a4e7ee29c56261751bf5e98347))
* **macos:** scaffold the menu-bar app, MonkiCore and MonkiPlatform packages ([b21e1fe](https://github.com/MikePineda/monki-focus/commit/b21e1fe97e2d856bae8a7ec72a1469450acb8624))
* **protocol:** add the native messaging bridge schemas and fixtures ([94e1ff8](https://github.com/MikePineda/monki-focus/commit/94e1ff84744c05955d9148f198b2bca5bfd447fd))


### Security

* **macos:** harden the bridge socket against squatters, floods and forged stats ([5961f53](https://github.com/MikePineda/monki-focus/commit/5961f5385791b5ba1ec84836f874476b822d1d77))
