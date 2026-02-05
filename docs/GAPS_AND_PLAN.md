# Gaps and Plan: Secure RAG Upgrade

This document lists current gaps and the change plan aligned to Phases B–F. See `ARCHITECTURE_CURRENT.md` for the baseline.

---

## Gaps

1. **No vector RAG** — No embeddings, no chunking, no vector store. RAG is keyword + full-doc concatenation in the chat route. Not scalable or “answerable + fast” with proper retrieval.

2. **No 3-layer RAG security** — Lakera is used only on chat input and chat output (and on file content when the client calls `/api/scan`). There is no defined pipeline for: (1) ingestion scan, (2) retrieval scan, (3) generation scan.

3. **No hard server-side “Lakera before index”** — `/api/files/store` accepts pre-scanned status from the client. A client could store content without ever calling Lakera. Required: extract text → Lakera `scanIngestion` → if blocked do not index/store for RAG.

4. **No RAG-specific policy layer** — No central place for “HIGH → quarantine / do not index”, “MEDIUM → restrict or redact”, “generation blocked → safe message”. Policy and audit events are ad hoc.

5. **No citations / confidence / feedback** — No citation panel, no “confidence/context” meter, no two-stage answer (short + expand), no thumbs up/down or reasons.

6. **No telemetry or eval** — No metrics (latency, chunks dropped, not_enough_context, thumbs_down) and no eval harness for RAG quality.

---

## Plan (aligned to phases)

### Phase B — Module boundaries (add new code, keep old intact)

- **New modules:**  
  `lib/security/lakera.ts`, `lib/security/rag-scan.ts`, `lib/policies/rag-policy.ts`,  
  `lib/rag/chunking.ts`, `lib/rag/index.ts`, `lib/rag/retrieve.ts`, `lib/rag/answer.ts`,  
  `lib/telemetry/metrics.ts`.
- **New docs:** `docs/RAG_SECURITY_MODEL.md`, `docs/FINE_TUNE_VS_RAG.md`.
- Do not remove or replace the existing RAG path; keep it behind a feature flag or parallel path.

### Phase C — Lakera hard gate + 3-layer RAG scan

- **C1** `lib/security/lakera.ts`: Read env `LAKERA_API_KEY` (optional `LAKERA_PROJECT_ID`). Implement `scanTextWithLakera({ text, context, source, meta })` → POST `https://api.lakera.ai/v2/guard`. Normalize output: `{ allowed, flagged, categories, severity, redactions?, raw }`. Never log raw text.
- **C2** `lib/security/rag-scan.ts`: `scanIngestion(text, meta)`, `scanRetrieval(chunks, meta)`, `scanGeneration(answer, meta)` calling Lakera + policy.
- **C3** `lib/policies/rag-policy.ts`: Rules — HIGH: ingestion quarantine / no index, retrieval drop/taint, generation block; MEDIUM: restrict/redact/allow with constraints; audit event: docId/userId/layer/outcome/categories/severity/timestamp (no sensitive content).

### Phase D — Answerable + fast RAG pipeline

- **D1** `lib/rag/chunking.ts`: Clean text (boilerplate, de-dup, normalize); chunk by headings/semantic boundaries then token-length; ~300–700 tokens, 50–100 overlap; metadata: docId, filename, sectionTitle, page?, createdAt, tenantId, classification, chunkIndex.
- **D2** `lib/rag/index.ts`: Extract text → `scanIngestion` → if blocked quarantine and STOP; else chunk → embed (adapter if none) → upsert to vector store; idempotency by content hash.
- **D3** `lib/rag/retrieve.ts`: Embed question; query vector store topK 8–15; metadata filters; `scanRetrieval` (drop/redact flagged); optional rerank; if &lt;2 safe chunks or low confidence → NOT_ENOUGH_CONTEXT.
- **D4** `lib/rag/answer.ts`: Generate strictly from retrieved chunks; citations (chunkId + doc label); “Not found in uploaded documents” when not in sources; then `scanGeneration`; if blocked return safe refusal.

### Phase E — Enforce Lakera-first on file scan/upload

- In the handler that decides “this file is stored and used for RAG” (e.g. `/api/files/store` or new `/api/rag/ingest`): (1) extract text best-effort, (2) `scanIngestion(text, meta)` with source `file_upload`, (3) if blocked: do not index, do not pass to LLM, return UX message (content security violation), (4) if allowed: existing malware/TE scan if applicable, then index into RAG. Non–text-extractable (e.g. image-only PDF): mark not indexable or manual approval; still allow malware scan.

### Phase F — UX + metrics

- **F1** UI: Citations panel (doc + section/page + excerpt), confidence/context meter, two-stage answer (short + top citations, then “Expand”), thumbs up/down with reasons (e.g. wrong citation, missing source, too slow).
- **F2** `lib/telemetry/metrics.ts`: ingestion_scan_latency_ms, retrieval_latency_ms, generation_latency_ms, chunks_retrieved_count, chunks_dropped_by_security_count, not_enough_context_rate, thumbs_down_rate.
- **F3** Eval: `scripts/eval-rag.(ts|js|py)`, input `eval/questions.jsonl`, output `eval/results.json` (citation presence, answerability, latency).

### Tests + CI

- Unit: Lakera client (mock HTTP), chunking (stability + metadata), retrieval filtering after scan.
- Integration: upload doc with injection → quarantined and not indexed; retrieval returns injection chunk → dropped; generation flagged → blocked.
- CI: lint, typecheck, tests. Feature flag e.g. `SECURE_RAG_ENABLED=true` to run new path.

---

## Deliverables checklist (all must exist)

- [x] docs/ARCHITECTURE_CURRENT.md
- [x] docs/GAPS_AND_PLAN.md
- [ ] docs/RAG_SECURITY_MODEL.md
- [ ] docs/FINE_TUNE_VS_RAG.md
- [ ] New modules under lib/security, lib/rag, lib/policies, lib/telemetry
- [ ] All 3 scan layers wired (Phase C)
- [ ] File scan route enforces Lakera first (Phase E)
- [ ] UI citations + confidence + feedback (Phase F)
- [ ] Telemetry + eval harness (Phase F)
- [ ] Tests + CI updated
