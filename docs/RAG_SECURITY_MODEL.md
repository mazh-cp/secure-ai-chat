# RAG Security Model

Threat model and mitigation mapping for the Secure RAG pipeline.

---

## Threat model

### 1. Prompt injection / system override (in user or document content)

- **Ingestion**: Malicious or poisoned text in uploaded files (e.g. “Ignore previous instructions…”).
- **Retrieval**: A retrieved chunk contains injection text that could steer the model.
- **Generation**: The model output could be manipulated to leak instructions or behave unsafely.

**Mitigation:**

- **Ingestion**: `scanIngestion(text)` via Lakera Guard before indexing. If severity HIGH or categories include prompt_injection/system_override → **QUARANTINE** (do not index). Policy: `lib/policies/rag-policy.ts`.
- **Retrieval**: `scanRetrieval(chunks)` on each candidate chunk; **DROP** flagged chunks; mark retrieval **tainted** if too many dropped.
- **Generation**: `scanGeneration(answer)` on final response; if blocked → **BLOCK** and return safe refusal message.

### 2. Data poisoning

- **Ingestion**: Documents crafted to inject false or biased “facts” into the knowledge base.

**Mitigation:**

- **Ingestion**: Same Lakera scan; category `data_poisoning` (or high-risk categories) → **QUARANTINE**. Optional: human review or restricted index for MEDIUM.

### 3. PII / sensitive data leakage

- **Generation**: Model repeats PII from retrieved chunks.

**Mitigation:**

- Lakera can detect PII in content; policy can **redact** or **allow_restricted** at retrieval/generation. Citations and context should avoid logging raw PII.

### 4. Malicious files (malware, binaries)

- **Ingestion**: File upload of executables or malware.

**Mitigation:**

- Existing Check Point TE (Threat Emulation) and file-type validation. Secure RAG adds **content** scan (Lakera) before indexing; binary/non–text-extractable files are marked not indexable or require manual approval.

---

## Mitigation mapping

| Layer      | Threat                    | Action (HIGH)            | Action (MEDIUM)                                   |
| ---------- | ------------------------- | ------------------------ | ------------------------------------------------- |
| Ingestion  | Injection, poisoning, PII | QUARANTINE, no index     | allow_restricted / exclude from default retrieval |
| Retrieval  | Risky chunk               | DROP chunk, mark tainted | Redact risky spans when possible                  |
| Generation | Unsafe output             | BLOCK, safe message      | Allow with stricter grounding/citations           |

---

## Audit and logging

- **No sensitive content**: Audit events must not log raw document text or user secrets.
- **Fields**: docId, userId, tenantId, layer, outcome, categories, severity, timestamp.
- **Storage**: Use `lib/policies/rag-policy.ts` `createAuditEvent()` and existing system logging or telemetry (e.g. `lib/telemetry/metrics.ts`, `lib/system-logging.ts`).

---

## Implementation references

- **Lakera client**: `lib/security/lakera.ts` — `scanTextWithLakera()`
- **3-layer scan**: `lib/security/rag-scan.ts` — `scanIngestion`, `scanRetrieval`, `scanGeneration`
- **Policy**: `lib/policies/rag-policy.ts` — `applyPolicy()`, `createAuditEvent()`
