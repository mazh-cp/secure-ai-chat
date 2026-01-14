# PR Merge and Release Instructions

**PR:** Release v1.0.10: Enhanced RAG System  
**Branch:** `release/1.0.10` → `main`  
**Tag:** `v1.0.10`

---

## Step 1: Review and Approve PR

1. Review the PR on GitHub
2. Check all CI checks pass (if configured)
3. Approve the PR

---

## Step 2: Merge PR to Main

### Option A: Merge via GitHub Web Interface
1. Go to the PR page
2. Click "Merge pull request"
3. Choose merge strategy (recommended: "Create a merge commit")
4. Confirm merge

### Option B: Merge via GitHub CLI
```bash
# Checkout main and pull latest
git checkout main
git pull origin main

# Merge release branch
git merge release/1.0.10

# Push to main
git push origin main
```

---

## Step 3: Create GitHub Release

### Option A: Via GitHub Web Interface
1. Go to: https://github.com/mazh-cp/secure-ai-chat/releases
2. Click "Draft a new release"
3. **Tag:** Select `v1.0.10` (or type `v1.0.10`)
4. **Title:** `Release v1.0.10: Enhanced RAG System`
5. **Description:** Copy from `RELEASE_v1.0.10.md` or use:

```markdown
## 🎯 What's New

### Enhanced RAG (Retrieval Augmented Generation) System

The chat client now automatically searches through uploaded files when answering questions. No more "please upload files" messages - the system intelligently finds relevant information from your uploaded data.

**Key Features:**
- ✅ Automatic file indexing on upload
- ✅ Intelligent content matching for data queries
- ✅ Search files first, fall back to LLM knowledge
- ✅ Support for CSV, JSON, and TXT files
- ✅ Enhanced file size and count limits
- ✅ Clear file citations in responses

## 📋 Changes

### Added
- Enhanced RAG system with automatic file indexing
- Improved content matching algorithm
- System message for LLM file access instructions
- Enhanced file context formatting

### Improved
- File access control (more inclusive filtering)
- Content matching for data/PII queries
- LLM instructions about available files

### Fixed
- Chat client not finding uploaded files issue

## 🔒 Security

- ✅ All security checks passed
- ✅ No API keys in source code
- ✅ Sensitive files properly ignored

## 📚 Documentation

- See `RELEASE_v1.0.10.md` for full release notes
- See `docs/USER_GUIDE_RAG.md` for RAG usage guide

## 🚀 Upgrade

For existing installations:
```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

For new installations:
See `docs/INSTALL_UBUNTU_VM.md`
```

6. Click "Publish release"

### Option B: Via GitHub CLI
```bash
gh release create v1.0.10 \
  --title "Release v1.0.10: Enhanced RAG System" \
  --notes-file RELEASE_v1.0.10.md
```

---

## Step 4: Verify Release

1. Check release page: https://github.com/mazh-cp/secure-ai-chat/releases/tag/v1.0.10
2. Verify tag exists on main branch
3. Test upgrade script on a test server

---

## Step 5: Update Remote Installations

After release is published, update remote installations:

```bash
# On remote server
cd /opt/secure-ai-chat
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

---

## Post-Release Checklist

- [ ] PR merged to main
- [ ] GitHub release created with tag v1.0.10
- [ ] Release notes published
- [ ] Remote installations updated
- [ ] Version API returns 1.0.10
- [ ] RAG functionality tested on production

---

**Status:** Ready for merge and release  
**Date:** January 13, 2025
