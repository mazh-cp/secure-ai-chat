# Pre-Flight Safety Audit
**Date**: 2026-01-XX  
**Branch**: `release/unifi-theme-safe-final`  
**Version**: 1.0.4

## A) Runtime Entrypoints and Production Paths

### 1. Next.js Build/Start Flow
- **Build Command**: `npm run build` → `next build`
  - Output: `.next/standalone` (for Docker) and `.next/static`
  - Config: `next.config.js` with `output: 'standalone'`
  - Security Headers: Configured in `next.config.js`
  
- **Start Command**: `npm run start` → `next start`
  - Port: 3000 (configurable via `PORT` env var)
  - Hostname: 0.0.0.0 (configurable via `HOSTNAME` env var)

### 2. Docker Configuration
- **Dockerfile**: `./Dockerfile`
  - Base: `node:20-alpine`
  - Build: Multi-stage build with `standalone` output
  - Runtime: Non-root user `nextjs` (UID 1001)
  - Port: 3000
  - CMD: `["node", "server.js"]` (from standalone output)
  
- **docker-compose.yml**: `./docker-compose.yml`
  - Service: `secure-ai-chat`
  - Port mapping: `3000:3000`
  - Health check: `/api/health` endpoint
  - Restart policy: `unless-stopped`

### 3. systemd Unit
- **File**: `secure-ai-chat.service`
- **Location**: `/etc/systemd/system/secure-ai-chat.service`
- **Working Directory**: `/home/adminuser/secure-ai-chat`
- **User/Group**: `adminuser`
- **ExecStart**: `/home/adminuser/.nvm/versions/node/v25.2.1/bin/npm start`
- **Restart**: `always` (with 5s delay)
- **Environment**: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`
- **ReadWritePaths**: `.secure-storage`, `.next`
- **Security**: `NoNewPrivileges=true`, `PrivateTmp=true`

### 4. Kubernetes Deployment
- **File**: `k8s-deployment.yaml`
- **Replicas**: 2
- **Image**: `secure-ai-chat:latest`
- **Port**: 3000 (container), 80 (service)
- **Probes**:
  - Liveness: `/api/health` (30s delay, 10s interval)
  - Readiness: `/api/health` (10s delay, 5s interval)
- **Resources**: 256Mi-512Mi memory, 250m-500m CPU

### 5. Security Headers (next.config.js)
- ✅ `X-DNS-Prefetch-Control: on`
- ✅ `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- ✅ `X-Frame-Options: SAMEORIGIN`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: origin-when-cross-origin`
- ✅ `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- ⚠️ **No CSP (Content Security Policy)** - Consider adding if needed

### 6. Middleware
- **File**: None found (`middleware.ts` not present)
- **Note**: No custom middleware; Next.js default handling

## B) Environment Variables

### Required Variables (Must be set)
1. **None strictly required at startup** (all keys can be configured via Settings UI)

### Optional Variables (Server-side)
1. **OPENAI_API_KEY** - OpenAI API key (can be set via Settings UI)
2. **LAKERA_AI_KEY** - Lakera AI API key (can be set via Settings UI)
3. **LAKERA_ENDPOINT** - Lakera API endpoint (default: `https://api.lakera.ai/v2/guard`)
4. **LAKERA_PROJECT_ID** - Lakera project ID (optional)
5. **CHECKPOINT_TE_API_KEY** - Check Point TE API key (can be set via Settings UI)

### Optional Variables (App configuration)
6. **LAKERA_TELEMETRY_ENABLED** - Enable telemetry (default: `true`)
7. **LAKERA_TELEMETRY_ENDPOINT** - Telemetry endpoint (default: `https://api.lakera.ai/v2/telemetry`)
8. **NEXT_PUBLIC_APP_NAME** - App name (default: "Secure AI Chat")
9. **NEXT_PUBLIC_APP_VERSION** - App version (default: "0.1.0")
10. **PORT** - Server port (default: `3000`)
11. **HOSTNAME** - Server hostname (default: `0.0.0.0`)
12. **NODE_ENV** - Node environment (default: `production` in Docker/systemd)

### Environment Variable Usage
- **Server-side only**: All API keys accessed via `process.env.*`
- **Client-side**: Only `NEXT_PUBLIC_*` variables exposed to browser
- **Storage**: API keys stored server-side in `.secure-storage/` (encrypted)
- **Validation**: Keys validated at runtime, not startup (graceful degradation)

### Missing `.env.example` File
- ⚠️ **Note**: `.env.example` referenced in README but not found in repo
- **Recommendation**: Create `.env.example` for documentation

## C) Production Entrypoints Summary

| Entrypoint | Command | Port | Health Check |
|------------|---------|------|--------------|
| Next.js Dev | `npm run dev` | 3000 | N/A |
| Next.js Prod | `npm run start` | 3000 | `/api/health` |
| Docker | `docker-compose up` | 3000 | `/api/health` |
| systemd | `systemctl start secure-ai-chat` | 3000 | `/api/health` |
| Kubernetes | `kubectl apply -f k8s-deployment.yaml` | 80→3000 | `/api/health` |

## D) Critical API Routes

1. **`/api/health`** - Health check (200 OK if service running)
2. **`/api/health/openai`** - OpenAI key validation
3. **`/api/keys`** - API key management (POST/DELETE)
4. **`/api/keys/retrieve`** - API key retrieval (GET, server-side only)
5. **`/api/chat`** - Chat functionality (POST)
6. **`/api/scan`** - File scanning (POST)
7. **`/api/settings/status`** - Settings status (GET)
8. **`/api/te/config`** - Check Point TE config (GET/POST/DELETE)
9. **`/api/te/upload`** - Check Point TE file upload (POST)
10. **`/api/te/query`** - Check Point TE query (POST)
11. **`/api/pin`** - PIN verification (GET/POST/DELETE)
12. **`/api/logs/system`** - System logs (GET/POST/DELETE)

## E) Security Considerations

### ✅ Strengths
- API keys stored server-side (encrypted)
- Security headers configured
- Non-root Docker user
- systemd security hardening
- PIN protection for sensitive operations

### ⚠️ Areas for Improvement
- No `.env.example` file (documentation only)
- No startup validation of required env vars (graceful degradation)
- No CSP header (consider adding)
- Dockerfile uses Node 20, but package.json requires Node 25.2.1 (mismatch)
- systemd service hardcoded to Node 25.2.1 path

### 🔒 Secrets Management
- ✅ No secrets in source code
- ✅ No secrets in build output
- ✅ All API keys stored server-side
- ✅ Client components never import `api-keys-storage.ts`

## F) Dependencies

### Production Dependencies
- `next: ^14.0.0`
- `react: ^18.2.0`
- `react-dom: ^18.2.0`
- `typescript: ^5.2.2`
- Other: `date-fns`, `form-data`, `undici`

### Development Dependencies
- `eslint`, `@typescript-eslint/*`
- `prettier`
- `tailwindcss`, `autoprefixer`, `postcss`

### Node.js Version
- **Required**: Node.js 25.2.1 (as per `package.json` engines)
- **Docker**: Node.js 20 (mismatch - needs fixing)
- **systemd**: Node.js 25.2.1 (via nvm)

---

**Next Steps**:
1. ✅ Create `.env.example` for documentation
2. ✅ Fix Dockerfile Node version mismatch
3. ✅ Add env var validation script (optional, non-blocking)
4. ✅ Verify all entrypoints work
5. ✅ Create final branch
