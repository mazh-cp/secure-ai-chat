# Release 1.0.12 and Freeze (pre–Jan 19, 2026)

## Freeze baseline (one-time)

1. **Tag the last commit before 2026-01-19 as immutable:**
   ```bash
   # From repo root; use the commit that is the last before Jan 19, 2026
   COMMIT=$(git rev-list -n1 --before="2026-01-19" HEAD)
   git tag v1.0.11-freeze "$COMMIT"
   git push origin v1.0.11-freeze
   ```

2. **Create the release branch and move new work there:**
   ```bash
   git checkout -b release/1.0.12
   git push -u origin release/1.0.12
   ```
   All new changes for 1.0.12 should be committed on `release/1.0.12` (or main after merge).

## Guard script

- **Script:** `scripts/guard-prejan19.sh`
- **NPM:** `npm run guard:freeze`
- **Behavior:** Fails if any file changed vs `v1.0.11-freeze` is **outside** these paths:
  - File: `app/api/files/`, `app/files/`, `lib/registry/`, `lib/storage/`, `lib/files/`, `lib/persistent-storage.ts`, `components/FileList.tsx`, `components/FileUploader.tsx`, `types/files.ts`
  - RAG: `lib/rag/`, `lib/file-content-processor.ts`, `lib/policies/`, `app/api/chat/`
  - Security: `app/api/scan/`, `lib/security/`
  - Allowed meta: `app/api/health/`, `app/api/version/`, `scripts/guard-prejan19.sh`, `scripts/smoke-*.sh`, `docs/`, `package.json`, `CHANGELOG.md`, `.github/workflows/ci.yml`
- **CI:** The guard runs in CI on `main` and `release/1.0.12`. If the tag `v1.0.11-freeze` is missing, the guard exits with instructions to create it.

## Backward compatibility

- Do **not** remove or rename API routes or response fields.
- Only **add** fields (e.g. `ragStatus`, `version` in health) or new endpoints (e.g. `POST /api/files/:id/reindex`).

## Tag v1.0.12 after tests pass

1. Ensure CI is green on `release/1.0.12` (guard + lint + type-check + build).
2. Tag and push:
   ```bash
   git checkout release/1.0.12
   git pull
   git tag v1.0.12
   git push origin v1.0.12
   ```

Optional: merge `release/1.0.12` into `main` and then tag from `main` if your process prefers that.
