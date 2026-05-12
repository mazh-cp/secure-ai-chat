# Lakera Guard Observability & Telemetry

**Version:** v1.1.13+  
**Status:** Accurate as of current implementation in `lib/lakera-telemetry.ts`

---

## How Platform Visibility Works

Lakera Guard **automatically logs every POST `/v2/guard` call** on the platform dashboard when `project_id` is supplied. There is no separate telemetry API you need to call to get portal visibility.

### Operator workflow

```
1. Chat/scan request arrives
2. App calls POST /v2/guard with:
     project_id  → routes to your project policy
     metadata    → { user_id, session_id, ip_address, internal_request_id }
3. Guard returns { flagged, payload, breakdown, metadata.request_uuid }
4. App records request_uuid in local system log (service: lakera_guard)
5. To investigate: search platform.lakera.ai by request_uuid or project_id
```

`request_uuid` is the correlation key — it appears in both your local system logs and the Lakera portal. Every flagged scan can be looked up directly.

---

## Local Audit Logging (always-on)

After every Guard call, the app writes a structured audit row via `lib/system-logging.ts`:

```
service:    lakera_guard
context:    chat_input | chat_output | file_upload | rag_ingestion | rag_retrieval
flagged:    true / false
request_uuid: <from Guard response metadata>
project_id: <your project id, or null if unset>
category_keys: [prompt_injection, pii, ...]
detectors_triggered: N
detector_types: [...]
policy_ids: [...]
```

View these in the app's **System Logs** panel or via `GET /api/logs/system`.

### Disabling local audit rows

```bash
LAKERA_GUARD_AUDIT_LOG=false   # disables local lakera_guard system log rows
```

> **Warning:** Disabling audit rows removes your only local record of Guard decisions if the Lakera portal is unavailable. Do not disable in regulated environments without compensating controls.

---

## Optional HTTP Companion POST (opt-in)

The app can POST a JSON payload to a custom ingest endpoint after each scan. This is **off by default** and is **not** required for Lakera portal visibility.

```bash
LAKERA_TELEMETRY_HTTP=true                  # enable (default: disabled)
LAKERA_TELEMETRY_ENDPOINT=https://...       # custom ingest URL (optional)
```

> **Note:** `https://api.lakera.ai/v2/telemetry` is **not a valid endpoint** — it returns HTTP 404. Only set `LAKERA_TELEMETRY_ENDPOINT` if you have a custom log ingest pipeline. If you get 404 errors and `LAKERA_TELEMETRY_HTTP` is enabled, disable it.

---

## Last Guard Snapshot (v1.1.13+)

Each process keeps an in-process snapshot of the last Guard decision:

```
GET /api/lakera/last
```

Response:
```json
{
  "snapshot": {
    "recordedAt": "2026-05-12T10:00:00.000Z",
    "source": "chat_input",
    "guardHostname": "api.lakera.ai",
    "inputScope": "augmented",
    "monitoringOnly": false,
    "decision": {
      "scanned": true,
      "flagged": false,
      "requestUuid": "abc-123",
      "threatLevel": "low"
    }
  }
}
```

Useful for: verifying Guard is active, live debugging, operator health checks.  
Note: In multi-instance deployments, each Node process has its own snapshot only.

---

## Monitoring-Only Mode (v1.1.13+)

```bash
LAKERA_GUARD_MONITORING_ONLY=1
```

Run Guard in shadow/pilot mode: Guard scans run and are logged, but **eligible flags do not block requests**. Hard-blocks (local prescan hits, infrastructure errors) still apply.

Use during initial policy calibration to understand your Guard hit rate before enabling enforcement. **Not recommended for hardened production** — it accepts the risk of letting flagged content through.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `LAKERA_AI_KEY` / `LAKERA_API_KEY` | — | Guard API key (required) |
| `LAKERA_PROJECT_ID` | — | Your project ID (required in production; see below) |
| `LAKERA_ENDPOINT` | `https://api.lakera.ai/v2/guard` | Guard URL (use for regional endpoints) |
| `LAKERA_FAIL_CLOSED` | `true` in prod | Block on Guard errors (fail-closed) |
| `LAKERA_FAIL_CLOSED_ON_AUTH_ERROR` | `false` | Block on 401 (bad key) |
| `LAKERA_ENFORCE_STRICT` | `false` | Master switch: require project_id + enforce scans + block on 401 |
| `LAKERA_REQUIRE_PROJECT_ID` | `true` in prod with key | Require project_id or block |
| `LAKERA_ENFORCE_INPUT_OUTPUT_SCAN` | `false` | Always run chat input+output scans |
| `LAKERA_GUARD_MONITORING_ONLY` | `false` | Shadow mode: scan but don't block |
| `LAKERA_GUARD_INPUT_SCOPE` | `augmented` | `augmented` (after RAG injection) or `raw` |
| `LAKERA_GUARD_AUDIT_LOG` | `true` | Write local `lakera_guard` system log rows |
| `LAKERA_TELEMETRY_HTTP` | `false` | Enable HTTP companion POST to custom ingest |
| `LAKERA_TELEMETRY_ENDPOINT` | — | Custom ingest URL (only with `LAKERA_TELEMETRY_HTTP=true`) |
| `LAKERA_PRESCAN_MERGE_AFTER_GUARD` | `false` | Merge local regex pre-scan into Guard result (legacy) |
| `LAKERA_TIMEOUT_MS` | `10000` | Guard request timeout in ms |

---

## Project ID: Why It Matters

**Without `project_id`**, Guard applies Lakera's built-in default policy — not the policies you configured in your project on `platform.lakera.ai`.

In production with a Lakera key set, `LAKERA_REQUIRE_PROJECT_ID` defaults to `true`. Without a Project ID, all requests will be blocked with category `lakera_project_required`. Set your Project ID in Settings or via `LAKERA_PROJECT_ID`.

To opt out (intentionally use default policy):
```bash
LAKERA_REQUIRE_PROJECT_ID=false
```

---

## References

- [Lakera Guard API Documentation](https://docs.lakera.ai/docs/api/guard)
- [Lakera Platform Dashboard](https://platform.lakera.ai)
- Implementation: `lib/lakera-telemetry.ts`, `lib/lakera-guard-audit.ts`, `lib/lakera/guard-client.ts`
