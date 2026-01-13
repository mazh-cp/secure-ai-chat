# Release v1.0.10 - Enhanced RAG System

**Release Date:** January 13, 2025  
**Version:** 1.0.10  
**Type:** Minor Release (Feature Enhancement)

---

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

---

## 📋 Changes Summary

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

---

## 🔒 Security

- ✅ No API keys in source code
- ✅ All sensitive files properly ignored
- ✅ Secure storage verified
- ✅ Build output scanned for leaks

---

## 📚 User Guide

See `docs/USER_GUIDE_RAG.md` for detailed usage instructions.

---

## 🚀 Upgrade Instructions

### For Existing Installations

```bash
# On your server
cd /opt/secure-ai-chat
git pull origin main
npm ci
npm run build
sudo systemctl restart secure-ai-chat
```

Or use the upgrade script:

```bash
curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/upgrade_remote.sh | bash
```

### For New Installations

Follow the installation guide in `docs/INSTALL_UBUNTU_VM.md`

---

## 📝 Breaking Changes

None. This is a backward-compatible enhancement.

---

## 🐛 Known Issues

None reported.

---

## 📊 Technical Details

### File Processing
- Maximum file size: 10MB per file
- Maximum files processed: 5 most relevant files per query
- Supported formats: CSV, JSON, TXT
- File truncation: Intelligent truncation for files > 15KB

### Security
- Only safe files are searched (flagged/malicious files excluded)
- Files stored securely in `.storage/files/` directory
- All file access logged for security auditing

---

## 🙏 Acknowledgments

Thank you for using Secure AI Chat!

---

**Release Prepared By:** AI Assistant  
**Date:** January 13, 2025  
**Version:** 1.0.10
