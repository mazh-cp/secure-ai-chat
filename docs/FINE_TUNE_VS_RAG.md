# Fine-Tune vs RAG: Decision Guide

When to use RAG (retrieval-augmented generation) vs fine-tuning.

---

## Principle

- **RAG**: Use for **knowledge** — facts, docs, up-to-date data, domain content that can be retrieved at query time.
- **Fine-tune**: Use for **behavior and format** — tone, style, response structure, task-specific patterns that you want baked into the model.

---

## Use RAG when

- You need **current or frequently updated** information (e.g. docs, KB, policies).
- You have **many documents** and cannot fit them all in context or training.
- You need **citations** and traceability to source chunks.
- You want to **add/remove knowledge** without retraining (upload/delete docs).
- You have **multi-tenant or per-customer** content (different indexes per tenant).
- You need **ingestion/retrieval/generation security** (e.g. Lakera scan) on live content.

---

## Use fine-tuning when

- You need a **consistent tone, style, or format** (e.g. “always answer in bullet points”, “always start with a one-line summary”).
- You want the model to **follow a specific task pattern** (e.g. classification, extraction) that is stable and not document-specific.
- You have **limited, stable “knowledge”** that rarely changes and is small enough to train in.
- You do **not** need per-query retrieval or citations from a large corpus.

---

## Combine both

- **Fine-tune** for behavior (e.g. “answer briefly, then cite sources”).
- **RAG** for knowledge (retrieve from your docs, then generate with citations).
- Secure RAG adds **scan at ingestion, retrieval, and generation** so that both live docs and model output are checked.

---

## Code hooks (this repo)

- **RAG pipeline**: `lib/rag/` — chunking, index, retrieve, answer. Use when the answer depends on **uploaded or external documents**.
- **Chat without RAG**: Existing `app/api/chat/route.ts` path (no vector store). Use when the user is not asking over uploaded files.
- **Feature flag**: `SECURE_RAG_ENABLED=true` (or equivalent) to switch to the new Secure RAG path once implemented; keep existing path intact until then.
