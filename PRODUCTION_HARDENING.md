# Production Hardening Summary

## Files Changed

### Theme + Stability Changes
1. **`app/globals.css`** - Added safe fallbacks to CSS variables (e.g., `rgb(var(--text-primary, 240, 237, 244))`)
2. **`components/ErrorBoundary.tsx`** - NEW: Minimal React error boundary component
3. **`app/layout.tsx`** - Wrapped app with ErrorBoundary
4. **`app/api/health/route.ts`** - NEW: General health check endpoint (`/api/health`)
5. **`package.json`** - Added `check` and `check:ci` scripts for automated validation
6. **`next.config.js`** - Added `output: 'standalone'` for Docker support

### Operational Config Files (NEW)
7. **`docker-compose.yml`** - NEW: Docker Compose with restart policy and healthcheck
8. **`Dockerfile`** - NEW: Multi-stage Docker build with healthcheck support
9. **`secure-ai-chat.service`** - NEW: systemd service file with restart policy
10. **`k8s-deployment.yaml`** - NEW: Kubernetes deployment with liveness/readiness probes

## Verification

✅ **No folder/file renames** - All files in same locations  
✅ **No navigation/tab changes** - Routes and navigation unchanged  
✅ **Only minimal operational config changes** - Only restart/health configs added  
✅ **Typecheck passes** - `npm run type-check` ✅  
✅ **Lint passes** - `npm run lint` ✅  
✅ **CSS fallbacks added** - All critical CSS variables have fallback values

## How to Run Locally

### Development
```bash
npm install
npm run dev
```
App runs on http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

### Run Checks Before Committing
```bash
npm run check          # Typecheck + lint
npm run check:ci       # Typecheck + lint + format check
```

## Verify Restart Behavior

### Local Process (using PM2 or similar)
```bash
# Start with PM2
pm2 start npm --name "secure-ai-chat" -- start
pm2 save

# Kill process and verify restart
pm2 kill secure-ai-chat
# PM2 should restart automatically (if configured)
```

### Docker
```bash
# Start container
docker-compose up -d

# Kill container process
docker exec secure-ai-chat kill -9 1
# Docker should restart container automatically (restart: unless-stopped)

# Check health
docker-compose ps
curl http://localhost:3000/api/health
```

### systemd
```bash
# Install service
sudo cp secure-ai-chat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable secure-ai-chat
sudo systemctl start secure-ai-chat

# Kill process and verify restart
sudo systemctl status secure-ai-chat
sudo kill -9 $(pgrep -f "npm start")
# systemd should restart automatically (Restart=always, RestartSec=5)

# Check status
sudo systemctl status secure-ai-chat
curl http://localhost:3000/api/health
```

### Kubernetes
```bash
# Deploy
kubectl apply -f k8s-deployment.yaml

# Kill pod and verify restart
kubectl delete pod <pod-name>
# Kubernetes should create new pod automatically

# Check health
kubectl get pods
kubectl port-forward <pod-name> 3000:3000
curl http://localhost:3000/api/health
```

## Health Endpoint

- **Endpoint**: `GET /api/health`
- **Response**: `{ status: 'ok', timestamp: '...', service: 'secure-ai-chat' }`
- **Status Codes**: 200 (healthy), 500 (unhealthy)
- **Used by**: Docker healthcheck, Kubernetes liveness/readiness probes, systemd monitoring

## Error Boundary

- **Location**: `components/ErrorBoundary.tsx`
- **Coverage**: Wraps entire app in `app/layout.tsx`
- **Behavior**: Catches React errors, displays user-friendly message, logs to console (dev) or service (prod)
- **Fallback UI**: Minimal error message with reload button

## CSS Variable Fallbacks

All critical CSS variables now have fallback values:
- `rgb(var(--text-primary, 240, 237, 244))` - Dark mode fallback
- `rgb(var(--text-primary, 15, 23, 42))` - Light mode fallback
- Similar fallbacks for all theme tokens

This ensures the app never crashes due to missing CSS variables.
