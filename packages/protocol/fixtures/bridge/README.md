# Native messaging bridge fixtures

The conformance suite of the native messaging contract between the
extension, `monki-bridge` and the macOS app (`docs/CONTRACTS.md`, "Native
messaging"). The schemas are in [`../../schema/bridge`](../../schema/bridge).
All data is synthetic.

| Folder     | Shape                                                  | Who runs it                               |
| ---------- | ------------------------------------------------------ | ----------------------------------------- |
| `valid/`   | `{ name, direction, message }`                         | protocol (Ajv), extension (TS), MonkiCore |
| `invalid/` | `{ name, direction, reason, message \| text, padTo? }` | protocol (Ajv), extension (TS), MonkiCore |
| `frames/`  | `{ name, bytesHex, payload \| endOfStream \| error }`  | MonkiCore (the `monki-bridge` framing)    |

- `direction` is `extension-to-app` (what the app accepts) or
  `app-to-extension` (what the extension accepts).
- `reason` is the stable rejection code every validator returns, checked in
  this order: `too_large` (serialised over 1048576 bytes), `invalid_json`,
  `invalid_envelope` (not an object with exactly `v`, `id`, `type`,
  `payload`; a bad `id`; a non-string `type`), `unsupported_version` (`v` is
  not 1), `unknown_type`, `wrong_direction` (a known type the sender may not
  send), `payload_not_object`, `invalid_payload` (the type's schema).
- `text` fixtures are raw JSON text and run where text is decoded (MonkiCore;
  the extension only ever receives parsed values from the browser).
- `padTo: { pointer, bytes }`: before validating, set the string at the JSON
  pointer to `x` repeated until the compact serialisation of `message` is
  `bytes` bytes long.
- `frames/` are the 4-byte length prefix in native byte order (little endian
  on every supported Mac) and the payload, as hex.
