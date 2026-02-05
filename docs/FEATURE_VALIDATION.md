# Feature / Functionality Validation

Local production validation checklist and acceptance criteria. Run the app in production mode with `bash scripts/run-local-prod.sh`, then perform the checks below.

---

## A) Settings & Keys

**Steps:**

- Open `/settings`.
- Save keys: OpenAI, Lakera, Check Point TE (if present in the UI).
- Reload the page or reopen `/settings` and confirm values persist.

**Persistence:**

- OpenAI / Lakera: stored in browser localStorage (client-side).
- Check Point TE (and server-stored keys): stored in `.secure-storage/` (server-side).

**Acceptance:**

- No console errors.
- Settings can be saved and reloaded without errors.
- After refresh, keys are still present (or show as “configured” where the app does not expose raw values).

---

## B) Chat flow

**Steps:**

- Open `/` (home page; chat is on the same page).
- Send a simple prompt (e.g. “Say hello in one word”).
- Wait for the response.

**Acceptance:**

- Response appears in the chat UI.
- No “blank state” or stuck loading.
- No hydration errors in the console.
- No unhandled promise rejections in the console.
- If API key is missing: user sees a clear message (not a blank screen).

---

## C) File upload + list

**Steps:**

- Open `/files`.
- Upload a small `.txt` or `.pdf` file.
- Confirm the file appears in the list.
- Optionally open or download the file if the UI allows.

**Acceptance:**

- Upload returns success (no 500).
- List updates and shows the new file.
- No 500 errors in network tab or server logs.
- Delete/clear (if used) works without 500s.

---

## D) RAG pipeline

**Steps:**

- Upload a file via `/files` (e.g. a short text file with a distinctive phrase).
- Ensure the file is indexed (list shows it; reindex available if the app exposes it: e.g. POST `/api/files/:id/reindex`).
- Open `/` (chat) and ask a question that should be answered from the uploaded content.
- Confirm the model’s answer references the file (citation/snippet or “from your document”).

**Acceptance:**

- Answer is relevant and includes a citation/snippet from the uploaded content where applicable.
- No obvious hallucination of unrelated facts from the file’s topic.
- No stream/JSON or RAG endpoint errors in console or network.

---

## E) Security scanning hooks

**Steps (if Lakera / ThreatCloud scanning is integrated):**

- Trigger a “known suspicious” test string or file (per vendor docs or test payloads).
- Observe app behavior: block, flag, or log.

**Acceptance:**

- App blocks or flags the content and does not crash.
- User sees a clear, friendly message (not a raw stack trace).
- Logs indicate the event cleanly (no uncaught exceptions).

---

## F) Error handling (missing required env)

**Steps:**

- Stop the app.
- Remove or unset a required env var (e.g. if the app requires something at startup), or remove OpenAI key and attempt chat.
- Start production: `npm run build && npm run start` (or run without the key).
- Trigger the flow that needs the key (e.g. send a chat message).

**Acceptance:**

- App does not show a blank screen.
- User sees a clear error screen or message (e.g. “API key missing” or “Configure your key in Settings”).
- Logs indicate what is missing or misconfigured (no silent failures).

---

## Quick reference

| Area            | Route / action              | Acceptance summary                          |
|----------------|-----------------------------|--------------------------------------------|
| Settings & keys| `/settings`, save & reload  | No console errors; persistence works      |
| Chat           | `/`, send message          | Response renders; no hydration/promise errors |
| File upload    | `/files`, upload + list    | Success; list updates; no 500s             |
| RAG            | Upload → chat with question| Citation/snippet; no RAG/stream errors      |
| Security scan  | Suspicious payload          | Block/flag + friendly message; clean logs  |
| Error handling | Missing env / key           | Clear message + logs; no blank screen     |

After running `bash scripts/run-local-prod.sh`, run route-level checks with:

```bash
BASE_URL=http://localhost:3000 bash scripts/prod-smoke.sh
```

(Use the port printed by `run-local-prod.sh` if different, e.g. `BASE_URL=http://localhost:3100`.)
