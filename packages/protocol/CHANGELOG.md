# Changelog

## 1.0.0 (2026-10-25)


### Added

* **protocol:** add key endorsement tokens and fix the policy hash ([fc6c5cc](https://github.com/MikePineda/monki-focus/commit/fc6c5cc81deb184cc20888d6c5fc2fd7dc06fa47))
* **protocol:** add PASETO v4.public unlock and policy tokens with shared vectors ([#2](https://github.com/MikePineda/monki-focus/issues/2)) ([e02ea7f](https://github.com/MikePineda/monki-focus/commit/e02ea7f1e0727b098f3405512f2072e2718c6882))
* **protocol:** add the native messaging bridge schemas and fixtures ([94e1ff8](https://github.com/MikePineda/monki-focus/commit/94e1ff84744c05955d9148f198b2bca5bfd447fd))
* **server:** add devices, enrolment, heartbeats, bypass events and the dead-man switch ([23a7880](https://github.com/MikePineda/monki-focus/commit/23a7880a50b367fe4ae60c2c8bc449baea75dd15))
* **server:** add guardian pairing, links, revocation and topic rotation ([5c4a730](https://github.com/MikePineda/monki-focus/commit/5c4a73089d5c509a421f13b95f7d59ac61cedbda))


### Security

* **server:** harden the dead-man switch, bypass details and token rotation ([929ea30](https://github.com/MikePineda/monki-focus/commit/929ea30818fd25e4f90656d2e65e09779a2a3e8f))
* **server:** keep the session and CSRF cookies to the dashboard routes ([3c4e67f](https://github.com/MikePineda/monki-focus/commit/3c4e67f189f7b2f2ea7c9759521f9d5bf9fbcb76))
