# Changelog

## 1.0.0 (2026-10-25)


### Added

* **android:** add device admin friction, the protection notice and exit and unlink to the app ([0868578](https://github.com/MikePineda/monki-focus/commit/0868578c6015d7a6d9401107d74c5c2482ec8290))
* **android:** add the local statistics screen ([9c3c397](https://github.com/MikePineda/monki-focus/commit/9c3c39758504bea199722fd897e5ecf6e84498e1))
* **android:** add the onboarding flow and the Status screen ([8655c95](https://github.com/MikePineda/monki-focus/commit/8655c95c631a7ee112a212f7f883cc9388dad549))
* **android:** add the onboarding, status and rules copy and two small components ([1a4000a](https://github.com/MikePineda/monki-focus/commit/1a4000a5bb9fb4812f0b98a4b0d04ba8069534bd))
* **android:** add the pure accessibility pipeline, gate coordinator and exit flow ([f3bb793](https://github.com/MikePineda/monki-focus/commit/f3bb7939c998d53769868afa6625cc384fb4055b))
* **android:** add the Room v1 data layer and the domain ports it implements ([f08d3c3](https://github.com/MikePineda/monki-focus/commit/f08d3c3c0669081e726506c63287de6e7e9328e5))
* **android:** add the token theme, base components and gate screens ([e99a548](https://github.com/MikePineda/monki-focus/commit/e99a548d89227ecfab93838d0b79d5a37565f1ac))
* **android:** classify screens with signed detector packs in :detectors ([c58510e](https://github.com/MikePineda/monki-focus/commit/c58510eff2dd3057ea0399a3300d35b984fe4d68))
* **android:** ingest usage events into sessions, web heartbeats and 5-minute blocks ([80a933f](https://github.com/MikePineda/monki-focus/commit/80a933f2eb22af7ac9d776cf4fa2bd89d592810e))
* **android:** mirror validUntil, the candidate helpers and the typed-intention rule ([5fadf7d](https://github.com/MikePineda/monki-focus/commit/5fadf7d9e5bab80be6dcd925e00f0a019162fd8f))
* **android:** port the analytics core to :core-domain ([50faee0](https://github.com/MikePineda/monki-focus/commit/50faee044ab2a32caf1737d6dffe3cbe85efe268))
* **android:** port the decision engine to :core-domain against the shared fixtures ([58b6fc6](https://github.com/MikePineda/monki-focus/commit/58b6fc6081dc1d40f650f1b19fc761785b93ab97))
* **android:** route the app through onboarding, Status, rules and exit ([81fa1af](https://github.com/MikePineda/monki-focus/commit/81fa1af025ba820bde597fc0b36102885a9607cf))
* **android:** save every rule change through the engine's rule-change policy ([8d61929](https://github.com/MikePineda/monki-focus/commit/8d61929d2a5359a5d54b2a1a668b2758929fb55e))
* **android:** scaffold the Gradle build, convention plugins and module skeleton ([#8](https://github.com/MikePineda/monki-focus/issues/8)) ([5ac7750](https://github.com/MikePineda/monki-focus/commit/5ac77504cbf445fb5ff48b5306ce3b1d49995d48))
* **android:** wire the accessibility service, overlay host and gate activity ([25bea8a](https://github.com/MikePineda/monki-focus/commit/25bea8ac1af4c7cbb415af8904230908c3087170))
* **android:** wire the workers, the bedtime warning and statistics into the app ([cff39c0](https://github.com/MikePineda/monki-focus/commit/cff39c00e2874495374c45c5ec8ea89693f8cc79))
* **rules:** add the Android detector packs, synthetic UI dumps and the dump sanitiser ([b0ba451](https://github.com/MikePineda/monki-focus/commit/b0ba45154d1eb9183ec29a7978003af4ecae9428))


### Fixed

* **android:** declare usage access and check the grant before reading usage events ([fb85730](https://github.com/MikePineda/monki-focus/commit/fb85730c3ddf66e0b34ce467dc6b8f882d16007c))
* **android:** open the accessibility details page by its action string ([8db97a5](https://github.com/MikePineda/monki-focus/commit/8db97a506d1a2390ccd2cb1c8a087c25595d4336))
* **android:** pin the starter preset and harden Status, rules and re-consent ([9bcfa92](https://github.com/MikePineda/monki-focus/commit/9bcfa9263b7ac516ff01b046f538098613b0f068))
* **android:** say what statistics keep of browser pages and that private tabs count ([c76108f](https://github.com/MikePineda/monki-focus/commit/c76108fd8ff1e0d9214ef6e43b81956574c4d005))


### Security

* **android:** ask for the notice before protection and show its status at home ([ccca29e](https://github.com/MikePineda/monki-focus/commit/ccca29e48fde6706c091fba5395eb64fb72bbf2e))
* **android:** close the accessibility service's review findings ([e478d1a](https://github.com/MikePineda/monki-focus/commit/e478d1a8bf4b54947287c2be8637943e7e79272d))
* **android:** enforce nothing until protection is armed in the app and seen ([67d8053](https://github.com/MikePineda/monki-focus/commit/67d8053fafedc0b5eb6cc261a2ff30022f60b2ca))
* **android:** harden the detectors and the pack loader after review ([f008f45](https://github.com/MikePineda/monki-focus/commit/f008f4582312f20bb0b75b22e6fb8b0d41e328ef))
* **android:** keep a URL's first segment only when a rule names it ([20aa873](https://github.com/MikePineda/monki-focus/commit/20aa87320b216ff17ab03824af0c3cb3fa5e2059))
* **android:** keep only the domain for URL-bar segments that can carry identifiers ([5679feb](https://github.com/MikePineda/monki-focus/commit/5679febe00c6f4f4612e9333ad7a29447479a602))
* **android:** trim WorkManager's merged manifest and pin its exported set ([2e46712](https://github.com/MikePineda/monki-focus/commit/2e467124efe2e3ba074783d1b2e3ebb420834589))


### Changed

* **android:** use the engine's friction candidates and typed-intention rule in the gate ([73d0843](https://github.com/MikePineda/monki-focus/commit/73d084332e3efe8de6f4942598630669ea824ff6))
