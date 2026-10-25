# Changelog

## 1.0.0 (2026-10-25)


### Added

* **extension:** add the intention gate driven by engine decisions ([696d12f](https://github.com/MikePineda/monki-focus/commit/696d12f8946b9498b5bcdb0c94f3eddb71d01110))
* **extension:** add the popup, the options page and rule changes through the engine policy ([6ec8b79](https://github.com/MikePineda/monki-focus/commit/6ec8b79e51f7cdce0dd8f0200c7d69ff5c34a998))
* **extension:** add the UI kit, theme preference and plural-aware i18n ([a1f47ff](https://github.com/MikePineda/monki-focus/commit/a1f47ffc306f851d18f8f4a716e88f1ad23e9c5b))
* **extension:** check stored escalation states with the precompiled schema ([15ac5b9](https://github.com/MikePineda/monki-focus/commit/15ac5b9c7a77058b98b4d514d51c15059a0d2352))
* **extension:** connect to the macos app through the native messaging bridge ([c495b5a](https://github.com/MikePineda/monki-focus/commit/c495b5adfafcdd02ed993e0a1e4ec5596ada35fd))
* **extension:** hide feeds and redirect Shorts from engine decisions ([d997223](https://github.com/MikePineda/monki-focus/commit/d99722390f6860e8c0e69b4f458deb5e2d268bc8))
* **extension:** name the YouTube You page surface in the catalogs ([958bd00](https://github.com/MikePineda/monki-focus/commit/958bd00a3b7665b87bc4eda860b8c9cd1e1f478b))
* **extension:** re-decide at each decision's validUntil instead of polling ([5f0d6c5](https://github.com/MikePineda/monki-focus/commit/5f0d6c54882f8adb94e72a546fbab727dfe268ac))
* **extension:** record intentions and emergency bypasses locally ([69c0927](https://github.com/MikePineda/monki-focus/commit/69c09272ad45062f2764e49d4220e81592ae8f77))
* **extension:** scaffold the WXT + Preact MV3 extension ([#6](https://github.com/MikePineda/monki-focus/issues/6)) ([24f3114](https://github.com/MikePineda/monki-focus/commit/24f311447cf0053988eda9077cb2871e8ba0af0e))
* **extension:** show the gate's intentions in the popup and the stats page ([ed834ba](https://github.com/MikePineda/monki-focus/commit/ed834ba99c34a691e20e8e6b1a74a96dd85a1bb1))
* **extension:** take friction candidates, budgeted rules and the intention rule from the engine ([1c36e5a](https://github.com/MikePineda/monki-focus/commit/1c36e5adcba6d28f0cdc7633560b0af7d91dd21a))
* **extension:** track focused browsing time and keep it in IndexedDB ([6d36a70](https://github.com/MikePineda/monki-focus/commit/6d36a70e59d2fb903eee9adda86c14635c92ebcc))


### Fixed

* **extension:** build dependencies before WXT prepare; longer engine test timeout ([ed1a0d9](https://github.com/MikePineda/monki-focus/commit/ed1a0d965f77997641c6eb3b9aa57e1a0c885432))
* **extension:** draw random names without modulo bias and give property tests CI headroom ([9352201](https://github.com/MikePineda/monki-focus/commit/9352201dc855b6b9f596fc390da85012cb6a4b94))
* **extension:** harden the feed guard against tampering, SPA gaps and stale decisions ([f41d33d](https://github.com/MikePineda/monki-focus/commit/f41d33d240f98a1ac60da8ff9544f752358a1265))
* **extension:** harden the intention gate against storage, clock and engine failures ([8a779c9](https://github.com/MikePineda/monki-focus/commit/8a779c9f4ca6f5023c2bec61e6c686aff8d4f474))
* **extension:** keep a waiting second time zone until its removal is due ([24b027d](https://github.com/MikePineda/monki-focus/commit/24b027db76f0f3c5970ff87645511e9e45f8c39f))
* **extension:** let a spent budget reach open pages within the minute ([0a3f443](https://github.com/MikePineda/monki-focus/commit/0a3f443092a273ffd5c664ef424db3d0101d0055))
* **extension:** make native messaging optional and keep block sync on until m6 ([9cb6112](https://github.com/MikePineda/monki-focus/commit/9cb6112b6e63360d580493ee8f259a56bd48f228))
* **extension:** one grant per emergency wait and a wall clock floor against rewinds ([9190855](https://github.com/MikePineda/monki-focus/commit/919085512056bc722eddd82aa6d8c05eda899217))
* **extension:** refuse a third time zone while a zone change waits ([0eded01](https://github.com/MikePineda/monki-focus/commit/0eded01e58457840927a2f21b6bd21cd4b4a6d1c))
* **extension:** tolerate clock steps of up to 30 s before ending lifts ([73bbe02](https://github.com/MikePineda/monki-focus/commit/73bbe0228d88daa6b00f916683d5f02d46504ab3))
