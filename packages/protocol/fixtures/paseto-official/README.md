# Official PASETO v4 test vectors (vendored)

`v4.json` is vendored from the PASETO standard test-vector repository:

- Source: <https://github.com/paseto-standard/test-vectors/blob/master/v4.json>
- Upstream commit: `32d7406591eb022f9eff88abb84106dd9d42c0f2`
- SHA-256 of the upstream file: `0b72948b65d1f73f574c9ad2aa3481ec27bf8c632f5f6e1596cd41f5b9703387`
- License: ISC, Copyright (c) 2021 Paragon Initiative Enterprises; the full
  text is in [`LICENSE`](LICENSE) next to this file.

The only local change is formatting (Prettier, to satisfy the repository's
`format:check`); the JSON content is identical to upstream. To compare, parse
both files and compare the values, not the bytes.

monki-focus uses only the `v4.public` cases (those with a `public-key`):
`4-S-1`, `4-S-2`, `4-S-3` (must verify and must re-sign to the same token)
and `4-F-1` (a `v4.local` token that a `v4.public` verifier must reject).
Every platform's verifier runs them; see
[`docs/protocol/unlock-tokens.md`](../../../../docs/protocol/unlock-tokens.md).
