# RAG (Retrieval Augmented Generation) User Guide

## Overview

The Enhanced RAG system automatically searches through your uploaded files when you ask questions in the chat. This means you can ask about users, data, records, or any information in your files, and the chat will find it automatically.

---

## How It Works

1. **Upload Files**: Upload CSV, JSON, or TXT files containing your data
2. **Ask Questions**: Simply ask questions about the data in natural language
3. **Automatic Search**: The system searches through uploaded files automatically
4. **Get Answers**: Receive answers with citations of which files were used

---

## Supported File Types

- **CSV files**: Comma-separated values (e.g., user lists, data exports)
- **JSON files**: Structured data (e.g., API responses, configuration data)
- **TXT files**: Plain text files (e.g., notes, logs, documentation)

**File Size Limits:**
- Maximum file size: 10MB per file
- Maximum files processed: 5 most relevant files per query

---

## Example Queries

### Data Queries
- "How many users are in the files?"
- "What is the email of user John?"
- "Show me all records from California"
- "What data fields are available?"

### User Queries
- "Find information about user with ID PID-123456"
- "List all users with email addresses"
- "Show me users from New York"

### Analysis Queries
- "What's the average income in the data?"
- "How many records have health insurance?"
- "Count users by state"

---

## Best Practices

1. **File Naming**: Use descriptive file names (e.g., `users_2025.csv`)
2. **Data Structure**: Keep data well-structured and consistent
3. **File Size**: Keep files under 10MB for best performance
4. **Security**: Only upload files that have passed security scans

---

## Troubleshooting

### Chat says "please upload files" even after uploading

**Solution:**
1. Check that files have completed security scanning
2. Verify files are in CSV, JSON, or TXT format
3. Ensure files are under 10MB
4. Try asking a more specific question about the data

### Chat can't find information in files

**Solution:**
1. Check that your question mentions data-related terms (user, record, data, etc.)
2. Verify the information exists in the uploaded files
3. Try rephrasing your question with specific keywords
4. Check file scan status (should be "safe" or "not_scanned")

### Files not being searched

**Solution:**
1. Ensure RAG is enabled (check Files page toggle)
2. Verify files passed security scans
3. Check file size (must be under 10MB)
4. Ensure files are in supported formats

---

## Security Notes

- Only safe files are searched (flagged/malicious files are excluded)
- Files are stored securely on the server
- No file content is exposed to unauthorized users
- All file access is logged for security auditing

---

## Technical Details

- **File Storage**: Files stored in `.storage/files/` directory
- **Metadata**: File metadata stored in `.storage/files-metadata.json`
- **Search Algorithm**: Keyword matching + data file detection
- **LLM Integration**: System message informs LLM about available files

---

For more information, see the main README.md
