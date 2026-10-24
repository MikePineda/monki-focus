# `@monki-focus/design-tokens`

Semantic light and dark design tokens for every monki-focus client, generated from one OKLCH source. Status: draft pending maintainer approval of the accent.

- `src/tokens.source.mjs`: the single source (colours in OKLCH, accent options, type, spacing, radius, motion). The accent is switched by its one `ACCENT` value.
- `dist/`: generated and committed outputs: `tokens.json`, `tokens.css`, `android/*.kt` (Compose), `macos/*.swift` (SwiftUI).
- `tests/`: the validators (WCAG contrast, Material pairs, focus-level ramp, accent separation, outputs up to date).

```bash
npm run build      # regenerate dist/
npm run docs       # regenerate docs/design/DESIGN.md and docs/design/README.md
npm test           # validators + "generated outputs are up to date"
```

Token tables, validator results, how to switch the accent and how each platform consumes the outputs: [`docs/design/README.md`](../../docs/design/README.md).
