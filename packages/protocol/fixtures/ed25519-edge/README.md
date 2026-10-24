# Ed25519 edge-case vectors (vendored, verify only)

Two third-party suites that probe how an Ed25519 verifier treats edge cases
(non-canonical encodings, small-order and mixed-order points, `S >= L`,
cofactored versus cofactorless equations). Every platform runs them through
its strict verifier (`docs/protocol/unlock-tokens.md` §1.1) and must produce
the verdicts in [`verdicts.json`](verdicts.json).

| File                           | Source                                                                                                                                                        | License                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `wycheproof-ed25519_test.json` | Project Wycheproof, `testvectors_v1/ed25519_test.json` (EddsaVerify), <https://github.com/C2SP/wycheproof>, commit `d17cc89fa5c8f4f4d378b5385ebf75da5d0926c9` | Apache-2.0, [`wycheproof-LICENSE`](wycheproof-LICENSE) |
| `speccheck-cases.json`         | "Taming the many EdDSAs" (SSR 2020), `cases.json`, <https://github.com/novifinancial/ed25519-speccheck>, commit `65519336fda78a3d016e947df6d82848aca0c9da`    | Apache-2.0, [`speccheck-LICENSE`](speccheck-LICENSE)   |

SHA-256 of the upstream files: `wycheproof-ed25519_test.json`
`ea80ffebac085e21cb9d3e903e7fa2b448d96702da5b31f061d0b83b430b74b3`,
`speccheck-cases.json`
`08e47a36d9aead288664930505584f353fff113ab854f2800db1e4f5b3540450`. The only
local change is Prettier formatting; the parsed JSON is identical.

## Expected verdicts (strict policy)

- Wycheproof: `valid` → accept, `invalid` → reject, and `acceptable` →
  **reject**. The acceptable cases use small-order or mixed-order public
  keys, which the strict policy refuses.
- Speccheck: all 12 cases → **reject**. Cases 0-5 and 8-11 have a public key
  (and in most cases an R) that is small-order or mixed-order; cases 6 and 7
  have `S >= L`. See `verdicts.json` for the reason per case.
