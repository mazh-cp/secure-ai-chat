# Release Gate Checklist (STRICT)

**Version**: 1.0.7  
**Last Updated**: January 2025

---

## 🔴 Hard Gates (MUST PASS - No Exceptions)

All checks below **MUST PASS** before deployment. Failure = DO NOT DEPLOY.

| Check                            | Command                              | Status      | Action on Fail               |
| -------------------------------- | ------------------------------------ | ----------- | ---------------------------- |
| **Clean Install**                | `npm ci` or detected package manager | ✅ REQUIRED | Fix dependency issues        |
| **TypeScript Compilation**       | `npm run type-check`                 | ✅ REQUIRED | Fix all type errors          |
| **ESLint Validation**            | `npm run lint`                       | ✅ REQUIRED | Fix all errors (warnings OK) |
| **Security: Client Key Leakage** | `grep -r checkpoint-te components/`  | ✅ REQUIRED | Remove client imports        |
| **Security: Build Output Scan**  | `grep -r "sk-" .next/static`         | ✅ REQUIRED | Remove keys from build       |
| **Production Build**             | `npm run build`                      | ✅ REQUIRED | Fix build errors             |
| **Git Secret Scan**              | `git grep "sk-[a-zA-Z0-9]\{48\}"`    | ✅ REQUIRED | Remove keys from code        |

---

## 🟡 Warnings (Non-Blocking but Recommended)

| Check            | Status         | Action                         |
| ---------------- | -------------- | ------------------------------ |
| **Format Check** | ⚠️ Recommended | Run `npm run format` if failed |
| **Node Version** | ⚠️ Recommended | Use Node 25.2.1                |
| **Git Status**   | ⚠️ Recommended | Commit/stash changes           |

---

## ✅ Automated Release Gate

Run the automated Release Gate script:

```bash
npm run release-gate
```

**Exit Code**: `0` = ✅ PASS (ready for deployment), `1` = ❌ FAIL (do NOT deploy)

---

## 📋 Manual Checklist (Before Deploying)

- [ ] Release Gate script passes (`npm run release-gate`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] No API keys in client code (verified by Release Gate)
- [ ] No API keys in build output (verified by Release Gate)
- [ ] No API keys in tracked files (verified by Release Gate)
- [ ] Production build succeeds (`npm run build`)
- [ ] All security checks pass (`npm run verify-security`)
- [ ] Backwards compatibility verified (existing users work)
- [ ] Error handling comprehensive (no crashes)
- [ ] Logging secure (no API keys exposed)

---

## 🚨 Common Failures & Fixes

| Failure            | Fix                                                   |
| ------------------ | ----------------------------------------------------- |
| TypeScript errors  | Run `npm run type-check` and fix errors               |
| ESLint errors      | Run `npm run lint` and fix errors                     |
| Client key leakage | Remove `checkpoint-te` imports from client components |
| Build failures     | Check build logs, fix compilation errors              |
| Secret leakage     | Remove API keys from source code                      |

---

**Status**: ✅ **PRODUCTION READY** (All checks passing)

---

**Last Updated**: January 2025  
**Maintained By**: Development Team
