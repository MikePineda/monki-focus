# Changelog

## 1.0.0 (2026-11-07)


### Added

* **macos:** add the app gate, bedtime window and emergency override domain ([95c3a77](https://github.com/MikePineda/monki-focus/commit/95c3a773f4d118761c6aa3eeb6428320855a6b78))
* **macos:** add the monki-bridge relay, the app socket server and the host manifest installer ([6cfaf41](https://github.com/MikePineda/monki-focus/commit/6cfaf411f72818f138d7dabb4d024fe12f93780f))
* **macos:** add the window and afk watchers, heartbeat queue and grdb event store ([b0bf66f](https://github.com/MikePineda/monki-focus/commit/b0bf66f463d405a030cdfd25240ee8270e992768))
* **macos:** hide gated and blocked apps and dim the screens at bedtime ([b5f2081](https://github.com/MikePineda/monki-focus/commit/b5f20817863214c9679fafd23ea1e90a7932f1a2))
* **macos:** port the analytics core to MonkiCore ([b96e2ff](https://github.com/MikePineda/monki-focus/commit/b96e2ff62d2dff18be05df86d02a48557a9ab11f))
* **macos:** port the decision engine to MonkiCore ([ff6389a](https://github.com/MikePineda/monki-focus/commit/ff6389aa5058a4a4e7ee29c56261751bf5e98347))
* **macos:** relax Friday and Saturday night bedtime and weekend short video in MonkiCore ([1b72bec](https://github.com/MikePineda/monki-focus/commit/1b72becdc5a54f3f52289938ae3516e67f12a769))
* **macos:** scaffold the menu-bar app, MonkiCore and MonkiPlatform packages ([b21e1fe](https://github.com/MikePineda/monki-focus/commit/b21e1fe97e2d856bae8a7ec72a1469450acb8624))
* **macos:** show the gate panel and bedtime overlay in the app ([5e3bdfd](https://github.com/MikePineda/monki-focus/commit/5e3bdfdba028203b138538b32b99de8be8b2b828))
* **protocol:** add the native messaging bridge schemas and fixtures ([94e1ff8](https://github.com/MikePineda/monki-focus/commit/94e1ff84744c05955d9148f198b2bca5bfd447fd))


### Security

* **macos:** harden the bridge socket against squatters, floods and forged stats ([5961f53](https://github.com/MikePineda/monki-focus/commit/5961f5385791b5ba1ec84836f874476b822d1d77))
