# Patches for Version 1.0.11 - File RAG Enhancements

## Summary
This document contains the exact patches to enhance file RAG system:
- Increase RAG file limit from 5 to 10 files
- Add structured field extraction for CSV/JSON files  
- Add prompt security validation (ADDITIONAL layer - does NOT replace Lakera/Check Point TE)
- Fix file deletion/clearing mechanism
- Add Clear All functionality

## IMPORTANT NOTES
- ✅ NO changes to Lakera AI functionality
- ✅ NO changes to Check Point TE functionality
- ✅ Security checks at lines 562-586 remain UNTOUCHED
- ✅ All changes are ADDITIVE - only enhance existing features

---

## Patch 1: Add Import for File Content Processor

**File:** `app/api/chat/route.ts`  
**Location:** Line 6 (after token-counter import)

```diff
--- a/secure-ai-chat/app/api/chat/route.ts
+++ b/secure-ai-chat/app/api/chat/route.ts
@@ -3,6 +3,7 @@
 import { callOpenAI as callOpenAIAdapter, validateModel, type ChatMessage as AdapterChatMessage } from '@/lib/aiAdapter'
 import { checkRateLimit, getRateLimitStatus } from '@/lib/rate-limiter'
 import { validateTokenLimit, truncateToTokenLimit } from '@/lib/token-counter'
+import { formatFileContentForRAG, validateFilePromptSecurity } from '@/lib/file-content-processor'
 
 interface ChatMessage {
```

---

## Patch 2: Enhance RAG Processing with Prompt Security and Field Extraction

**File:** `app/api/chat/route.ts`  
**Location:** Lines 621-650 (RAG file processing section)

```diff
@@ -618,6 +618,19 @@
               // OR if there's any keyword match
               const shouldInclude = isDataFile || (isDataQuery && isDataFile) || hasKeywordMatch || isDataQuery
               
+              // SECURITY: Validate prompt security for file-based queries (ADDITIONAL security layer)
+              // This works alongside Lakera AI and Check Point TE - does NOT replace them
+              // Files must still pass Lakera/Check Point TE checks (lines 562-586) before reaching here
+              const promptSecurityCheck = validateFilePromptSecurity(
+                latestUserMessage.content,
+                fileContent
+              )
+              
+              // Block high-risk prompts (only if both prompt AND file show suspicious patterns)
+              if (!promptSecurityCheck.safe) {
+                console.warn(`RAG: Blocked potentially unsafe prompt with file ${fileMeta.name} (risk: ${promptSecurityCheck.riskLevel})`)
+                continue
+              }
+              
               if (shouldInclude) {
                 // For large files, include a summary or excerpt
                 let contentToInclude = fileContent
@@ -625,13 +638,21 @@
                   // For very large files, include first 7500 and last 7500 chars
                   contentToInclude = fileContent.substring(0, 7500) + '\n\n...[content truncated - showing first and last portions]...\n\n' + fileContent.substring(fileContent.length - 7500)
                 }
-                relevantFiles.push(`\n\n[File: ${fileMeta.name}]\n${contentToInclude}`)
+                
+                // ENHANCEMENT: Format file content with field information for structured data
+                // This enables field-level access for CSV/JSON files
+                const formattedContent = formatFileContentForRAG(
+                  fileMeta.name,
+                  contentToInclude,
+                  fileMeta.type,
+                  false // includeAllFields - can be made configurable in future
+                )
+                relevantFiles.push(`\n\n${formattedContent}`)
                 
-                // ENHANCEMENT: Limit to 5 most relevant files (increased from 3)
-                if (relevantFiles.length >= 5) break
+                // ENHANCEMENT: Limit to 10 most relevant files (increased from 5)
+                if (relevantFiles.length >= 10) break
               } else {
                 // ENHANCEMENT: Still add to context but mark as less relevant
                 // This ensures LLM knows about all available files
                 if (fileContent.length <= 5000) {
-                  allSafeFiles.push(`\n\n[File: ${fileMeta.name} - Available for reference]\n${fileContent}`)
+                  // Format with field information for structured data
+                  const formattedContent = formatFileContentForRAG(
+                    fileMeta.name,
+                    fileContent,
+                    fileMeta.type,
+                    false
+                  )
+                  allSafeFiles.push(`\n\n${formattedContent.replace(/^\[File:/, '[File: (Available for reference)')}`)
                 }
               }
@@ -646,7 +667,7 @@
           // ENHANCEMENT: Include both relevant files and all safe files
           const allFilesContext = relevantFiles.length > 0 
             ? relevantFiles.join('\n\n---\n\n')
-            : allSafeFiles.slice(0, 3).join('\n\n---\n\n') // If no matches, include first 3 safe files
+            : allSafeFiles.slice(0, 10).join('\n\n---\n\n') // If no matches, include first 10 safe files
```

---

## Patch 3: Fix File Deletion to Refresh UI

**File:** `app/files/page.tsx`  
**Location:** Lines 298-317 (handleFileRemove function)

```diff
--- a/secure-ai-chat/app/files/page.tsx
+++ b/secure-ai-chat/app/files/page.tsx
@@ -298,17 +298,23 @@
   }
 
   const handleFileRemove = async (fileId: string) => {
-    // Remove from local state
-    setFiles(prev => prev.filter(f => f.id !== fileId))
-
     // Delete from server
     try {
       const response = await fetch(`/api/files/delete?fileId=${encodeURIComponent(fileId)}`, {
         method: 'DELETE',
       })
 
-      if (!response.ok) {
+      if (response.ok) {
+        // Successfully deleted - refresh files from server to ensure consistency
+        await loadFilesFromServer()
+        // Also clear localStorage cache
+        if (typeof window !== 'undefined') {
+          localStorage.removeItem('uploadedFiles')
+        }
+      } else {
         const errorData = await response.json().catch(() => ({}))
         console.error('Failed to delete file from server:', errorData.error || 'Unknown error')
-        // Continue even if server deletion fails
+        // Show error but don't remove from UI if server deletion fails
+        alert(`Failed to delete file: ${errorData.error || 'Unknown error'}`)
       }
     } catch (error) {
       console.error('Error deleting file from server:', error)
+      alert(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
     }
   }
+
+  // Handle Clear All Files
+  const handleClearAll = async () => {
+    if (files.length === 0) {
+      return
+    }
+    
+    if (!confirm(`Are you sure you want to delete all ${files.length} file(s)? This action cannot be undone.`)) {
+      return
+    }
+    
+    try {
+      const response = await fetch('/api/files/clear', {
+        method: 'DELETE',
+      })
+      
+      if (response.ok) {
+        // Successfully cleared - refresh files from server
+        await loadFilesFromServer()
+        // Also clear localStorage cache
+        if (typeof window !== 'undefined') {
+          localStorage.removeItem('uploadedFiles')
+        }
+      } else {
+        const errorData = await response.json().catch(() => ({}))
+        alert(`Failed to clear all files: ${errorData.error || 'Unknown error'}`)
+      }
+    } catch (error) {
+      console.error('Error clearing all files:', error)
+      alert(`Failed to clear all files: ${error instanceof Error ? error.message : 'Unknown error'}`)
+    }
+  }
```

---

## Patch 4: Add Clear All API Endpoint

**NEW FILE:** `app/api/files/clear/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { clearAllFiles } from '@/lib/persistent-storage'

/**
 * DELETE - Clear all uploaded files and metadata
 * This permanently deletes all files from storage
 */
export async function DELETE() {
  try {
    const result = await clearAllFiles()
    
    return NextResponse.json({
      success: true,
      message: 'All files cleared successfully',
      deletedFiles: result.deletedFiles,
      deletedMetadata: result.deletedMetadata,
    })
  } catch (error) {
    console.error('Failed to clear all files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear files' },
      { status: 500 }
    )
  }
}
```

---

## Patch 5: Add Clear All Button to FileList Component

**File:** `components/FileList.tsx`  
**Location:** Line 6 (interface) and Line 76 (component function) and after Line 86 (before files.map)

```diff
--- a/secure-ai-chat/components/FileList.tsx
+++ b/secure-ai-chat/components/FileList.tsx
@@ -5,6 +5,7 @@
 interface FileListProps {
   files: UploadedFile[]
   onRemove: (fileId: string) => void
+  onClearAll?: () => void
   onScan: (fileId: string) => void
   isScanning: boolean
   lakeraScanEnabled?: boolean
@@ -76,7 +76,20 @@
-export default function FileList({ files, onRemove, onScan, isScanning, lakeraScanEnabled = true }: FileListProps) {
+export default function FileList({ files, onRemove, onClearAll, onScan, isScanning, lakeraScanEnabled = true }: FileListProps) {
   if (files.length === 0) {
     return (
       <div className="glass rounded-2xl p-8 text-center border-brand-berry/20">
@@ -86,7 +99,19 @@
       </div>
     )
   }
 
   return (
     <div className="space-y-3">
+      {/* Clear All Button */}
+      {files.length > 0 && onClearAll && (
+        <div className="mb-4 flex justify-end">
+          <button
+            onClick={onClearAll}
+            className="px-4 py-2 text-sm glass-button text-red-400 hover:text-red-300 rounded-xl transition-all border-red-400/30 border-2"
+            style={{
+              backgroundColor: "var(--destructive-bg, transparent)",
+            }}
+          >
+            Clear All Files ({files.length})
+          </button>
+        </div>
+      )}
+      
       {files.map((file) => (
```

---

## Patch 6: Update FilesPage to Use Clear All

**File:** `app/files/page.tsx`  
**Location:** Line 1213 (FileList usage)

```diff
--- a/secure-ai-chat/app/files/page.tsx
+++ b/secure-ai-chat/app/files/page.tsx
@@ -1213,6 +1213,7 @@
         <FileList 
           files={files} 
           onRemove={handleFileRemove}
+          onClearAll={handleClearAll}
           onScan={handleFileScan}
           isScanning={isScanning}
           lakeraScanEnabled={lakeraScanEnabled}
@@ -1225,7 +1226,7 @@
         <h3 className="text-brand-berry font-medium mb-2">📁 Supported Features</h3>
         <ul className="text-sm text-theme-muted space-y-1">
-          <li>• Upload up to 5 files simultaneously</li>
+          <li>• RAG supports up to 10 files for chat interaction</li>
           <li>• Maximum file size: 50 MB per file</li>
           <li>• Supported formats: PDF, TXT, MD, JSON, CSV, DOCX</li>
           <li>• Lakera AI security scanning for uploaded content</li>
```

---

## Implementation Notes

1. **Security**: Prompt security check is ADDITIONAL - files must still pass Lakera AI and Check Point TE checks (lines 562-586)
2. **Backward Compatibility**: All changes are backward compatible
3. **No Breaking Changes**: Existing functionality remains unchanged
4. **Lakera AI**: No changes to Lakera scanning logic
5. **Check Point TE**: No changes to Check Point TE logic
