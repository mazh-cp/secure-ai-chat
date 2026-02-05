# Release Notes – v1.0.12 (2026-02-05)

## Summary

Version 1.0.12 adds **Anthropic (Claude) support** alongside OpenAI, improves **local server startup** for browser access, and documents the **npm devdir** warning fix.

## Highlights

### Anthropic (Claude) support
- **Provider selection** in chat: choose OpenAI or Anthropic; model list updates per provider.
- **Anthropic API key** in Settings (paste-only, server-side encrypted, PIN protection for clear).
- **Chat API** accepts `provider` and uses the same RAG/file context for both providers.
- **Models API**: `GET /api/models?provider=anthropic` returns Claude models; default remains OpenAI.
- **Adapter**: `callAnthropic()` in `lib/aiAdapter.ts` calling Anthropic Messages API.

### Local server and browser access
- **`npm run start:local`** – runs `next start -H 127.0.0.1`.
- **`npm run start:local:safe`** – frees port 3000 then starts at http://127.0.0.1:3000.
- **README** updated with steps when http://localhost:3000 is not accessible (use system terminal, 127.0.0.1, free port, `start:local:safe`).

### Documentation and fixes
- **devdir warning**: README and docs explain one-time fix `npm config delete devdir`.
- **ChatInterface**: fixed `apiKeys` possibly null when building request body (optional chaining).

## Upgrade

- No breaking changes. Existing OpenAI-only usage is unchanged.
- To use Claude: add Anthropic API key in Settings, then select provider “Anthropic” and a model in chat.

## Files changed (main)

- `app/api/chat/route.ts` – provider routing, Anthropic adapter
- `app/api/keys/route.ts`, `app/api/keys/retrieve/route.ts` – Anthropic key support
- `app/api/models/route.ts` – `?provider=anthropic` and static Claude list
- `lib/aiAdapter.ts` – `callAnthropic()`
- `lib/api-keys-storage.ts` – `anthropicApiKey` in stored keys
- `components/SettingsForm.tsx` – Anthropic API key field
- `components/ModelSelector.tsx` – provider + model controls
- `components/ChatInterface.tsx` – provider state, hasChatKey, body.provider
- `package.json` – start:local, start:local:safe
- `scripts/start-local.sh` – new
- `README.md`, `docs/DATA_STORAGE_AND_REINSTALL.md` – devdir and local access
- `CHANGELOG.md` – 1.0.12 entry

## Build and push

```bash
cd "/path/to/secure-ai-chat"
npm run build
git add -A
git status
git commit -m "Release v1.0.12: Anthropic support, start:local:safe, devdir docs"
git push
```

Optionally tag:

```bash
git tag -a v1.0.12 -m "Release v1.0.12"
git push origin v1.0.12
```
