# Styling revert summary (v1.0.12 → v1.0.11 parity)

**PR internal summary: which styling/build pipeline files were reverted**

- **app/layout.tsx** — Reverted: removed `data-theme="dark"` from `<html>`; body class from `min-h-screen h-full antialiased` back to `h-full antialiased` (v1.0.11). Globals.css import unchanged.
- **app/globals.css** — Reverted: `@tailwind` directives first, then `@import '../lib/theme/tokens.css'`; body rules only for `:root[data-theme="dark"]` and `:root[data-theme="light"]` (removed `:root:not([data-theme])`); removed v1.0.12-added glass/main/min-h-screen block; selector `*:not(input)...` reverted to `:not(input)...`.
- **tailwind.config.js** — Reverted: content order to `pages`, `components`, `app`; removed `./lib/**`; removed copper/harvest-gold/thunder and extra palette keys (border-default, bg-primary, bg-secondary, text-primary, accent-primary in palette); kept v1.0.11 legacy color mappings.
- **next.config.js** — Reverted: removed webpack watchOptions block; removed swcMinify (Next 16 ignores it). Production build still uses webpack via `scripts/build-with-data-paths.js` (`next build --webpack`).

**Not reverted (unchanged)**

- postcss.config.js, lib/utils.ts, components/Layout.tsx, ThemeProvider/contexts — no divergence from v1.0.11.
- No nested layouts; only `app/layout.tsx` imports globals.css.

**New**

- `scripts/check-css-prod.sh`: clean build, start server, curl homepage for `/_next/static/css/`, GET CSS → must be 200 and ≥1000 bytes.
- `scripts/release-gate.sh`: step 4c runs `check-css-prod.sh` after 4b.
