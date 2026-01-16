# Validating Fresh Install from Tag v1.0.11

## Understanding Detached HEAD State

When you checkout a tag (like `v1.0.11`), Git puts you in a "detached HEAD" state. **This is normal and expected behavior.**

### What This Means:
- ✅ You're viewing the exact code from the v1.0.11 release
- ✅ This is the correct state for validating a release
- ✅ You can build, test, and validate without issues
- ⚠️ Any commits you make won't be on a branch (but that's fine for validation)

### For Validation:
**You don't need to do anything special** - you can proceed directly with validation.

---

## Quick Validation Steps

### Step 1: Verify You're on the Right Tag
```bash
git describe --tags
# Should output: v1.0.11
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Build
```bash
npm run build
# Should show: ✓ Compiled successfully
```

### Step 4: Start Server
```bash
npm start
```

### Step 5: Validate Endpoints
```bash
# In another terminal, wait 8 seconds then run:
curl http://localhost:3000/api/health
curl http://localhost:3000/api/version
curl http://localhost:3000/api/waf/health
```

**Expected Results:**
- Health: `{"status":"ok"}`
- Version: `{"version":"1.0.11"}`
- WAF: `{"waf":{"integrated":true}}`

---

## Using the Automated Validation Script

If you want to run the automated validation:

```bash
# Make sure you're in the repository root
./scripts/validate-fresh-install.sh
```

This script will:
1. Check Node version
2. Verify installation
3. Run type check
4. Build the application
5. Start server
6. Test all endpoints
7. Stop server
8. Report results

---

## If You Want to Make Changes

If you need to make changes while on the tag, create a branch:

```bash
git switch -c validation-branch
# or
git checkout -b validation-branch
```

This creates a new branch from the tag, allowing you to commit changes.

---

## Returning to Main Branch

After validation, if you want to return to the main branch:

```bash
git switch main
# or
git checkout main
```

---

## Validation Checklist

- [ ] Tag v1.0.11 checked out
- [ ] Dependencies installed (`npm install`)
- [ ] Build successful (`npm run build`)
- [ ] Server starts (`npm start`)
- [ ] Health endpoint: `/api/health` → `{"status":"ok"}`
- [ ] Version endpoint: `/api/version` → `{"version":"1.0.11"}`
- [ ] WAF health: `/api/waf/health` → `{"waf":{"integrated":true}}`
- [ ] UI pages load in browser
- [ ] Settings page shows two-column layout
- [ ] Provider selector visible on chat page

---

## Troubleshooting

### Issue: "npm install" fails
- Check Node version: `node -v` (should be 25.2.1)
- Clear cache: `npm cache clean --force`
- Try: `rm -rf node_modules package-lock.json && npm install`

### Issue: Build fails
- Check TypeScript: `npm run type-check`
- Check for errors in output
- Verify all files are present

### Issue: Server won't start
- Check port 3000: `lsof -i :3000`
- Kill existing process: `lsof -ti:3000 | xargs kill -9`
- Try different port: `PORT=3001 npm start`

---

**Note**: Detached HEAD state is **perfectly fine** for validation. You don't need to create a branch unless you plan to make changes.
