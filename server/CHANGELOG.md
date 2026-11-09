# Changelog

## 1.0.0 (2026-11-09)


### Added

* **server:** add devices, enrolment, heartbeats, bypass events and the dead-man switch ([23a7880](https://github.com/MikePineda/monki-focus/commit/23a7880a50b367fe4ae60c2c8bc449baea75dd15))
* **server:** add guardian pairing, links, revocation and topic rotation ([5c4a730](https://github.com/MikePineda/monki-focus/commit/5c4a73089d5c509a421f13b95f7d59ac61cedbda))
* **server:** add pure unlock request rules and the ntfy message builder ([57bebdb](https://github.com/MikePineda/monki-focus/commit/57bebdb23519c14e981078e9b11817e4e5a47ecb))
* **server:** add signing keys, unlock/policy/time token issuance and GET /keys ([2489595](https://github.com/MikePineda/monki-focus/commit/24895950798c1e87805ec2e33123ea90d7452136))
* **server:** add the guardian pairing, link and summary rules ([e8888ca](https://github.com/MikePineda/monki-focus/commit/e8888ca0baf94b3dbafb0a744ed205ec426fd340))
* **server:** add users, sessions, invitations and two-step verification ([8621355](https://github.com/MikePineda/monki-focus/commit/8621355258f7c52d6db494a325cdfdc7eb13fc1d))
* **server:** publish the notification outbox to ntfy ([76bc329](https://github.com/MikePineda/monki-focus/commit/76bc329dd9c41a789e3639db15156683fc6853cb))
* **server:** scaffold the self-hostable AdonisJS server ([af4656e](https://github.com/MikePineda/monki-focus/commit/af4656e197d371f0a8028308fb2fa3fa6c963a2c))
* **server:** serve unlock requests end to end ([abbd957](https://github.com/MikePineda/monki-focus/commit/abbd9571dc0df1a83a129e9a2b2cc4c119aa2633))
* **server:** store unlock requests and tie the token ledger to them ([705693e](https://github.com/MikePineda/monki-focus/commit/705693eb122937852185f57917802f42d51ba5cf))
* **server:** sync the user's rule set across devices ([5270f22](https://github.com/MikePineda/monki-focus/commit/5270f22e98e721108827c97cad2afc525f71720a))


### Fixed

* **server:** add the ledger request foreign key as NOT VALID ([2bdd4b9](https://github.com/MikePineda/monki-focus/commit/2bdd4b93cdf053079074800404cf6e91ea901135))


### Security

* **server:** charge throttles before the check and harden revocation ([2edf9ad](https://github.com/MikePineda/monki-focus/commit/2edf9ad933948a9bcbf26bd1ec1d37930c98d1e8))
* **server:** evict retired keys from memory and require a 32-character APP_KEY in production ([f65a741](https://github.com/MikePineda/monki-focus/commit/f65a7417ea2d35c00477eec3f472e33a4f851471))
* **server:** give up outbox rows whose link or request is over ([b321f55](https://github.com/MikePineda/monki-focus/commit/b321f55d80103e1ae54d025970824afd369086c4))
* **server:** harden guardian pairing after review ([415ee3e](https://github.com/MikePineda/monki-focus/commit/415ee3ea81475794d7808808db70d8d9bf776bbb))
* **server:** harden test routes, client IP, log redaction and probes ([b06384f](https://github.com/MikePineda/monki-focus/commit/b06384ff58860de2f8ffa8ae857543b95a400538))
* **server:** harden the dead-man switch, bypass details and token rotation ([929ea30](https://github.com/MikePineda/monki-focus/commit/929ea30818fd25e4f90656d2e65e09779a2a3e8f))
* **server:** keep long dead-man gaps visible and lock users first everywhere ([28b3d5a](https://github.com/MikePineda/monki-focus/commit/28b3d5a07911e1460bc661f77ba9ef67748f3680))
* **server:** keep the session and CSRF cookies to the dashboard routes ([3c4e67f](https://github.com/MikePineda/monki-focus/commit/3c4e67f189f7b2f2ea7c9759521f9d5bf9fbcb76))
* **server:** make the limiter connection fail fast ([d6f6cfd](https://github.com/MikePineda/monki-focus/commit/d6f6cfd3e077c74009a03dc27ed80c1f55d6b53a))
* **server:** re-check the dead-man condition under the lock and take a no-key user lock ([d043d6f](https://github.com/MikePineda/monki-focus/commit/d043d6f4633a12790d0e38c12226349abd823477))
* **server:** refuse unstorable rule sets and keep pg context out of logs ([e7581f1](https://github.com/MikePineda/monki-focus/commit/e7581f1d3577e96fb9bc9724074342dc0b75ec98))
* **server:** tighten unlock decisions, guardian lists and sealed tokens ([61f5707](https://github.com/MikePineda/monki-focus/commit/61f57073abf269bcabdef1d3edb0128bc3e798da))
