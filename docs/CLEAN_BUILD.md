# Clean build (stale cache / unstyled UI)

If the UI looks unstyled or Tailwind/theme appears broken, clear caches and rebuild.

## Steps

```bash
# From repo root
rm -rf .next node_modules/.cache
npm run dev
# → Open http://localhost:3000 and confirm styling

# For production
rm -rf .next node_modules/.cache
npm run build
npm run start
# → Open http://localhost:3000 and confirm styling
```

## Validation scripts

- **Dev (server must be running):** `bash scripts/check-tailwind-css.sh` — fetches homepage CSS and asserts it contains Tailwind markers (`--tw-` or `preflight`) and size ≥ 40k bytes.
- **Prod:** `bash scripts/check-tailwind-css-prod.sh` — clean build, start server on port 3101, same assertions.
- **Prod CSS served:** `bash scripts/check-css-prod.sh` — clean build, start server on port 3100, homepage must link to `/_next/static/css/*.css` and that file returns 200 with size ≥ 1000 bytes.

Release gate runs both `check-css-prod.sh` (4c) and `check-tailwind-css-prod.sh` (4d) after the main build.
