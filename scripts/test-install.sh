#!/bin/bash
# Quick test script to verify install-ubuntu.sh works when piped

echo "Testing install script..."
echo "Downloading script..."
if curl -fsSL https://raw.githubusercontent.com/mazh-cp/secure-ai-chat/main/scripts/install-ubuntu.sh > /tmp/install-test.sh 2>&1; then
    echo "✅ Script downloaded successfully"
    echo "Checking script syntax..."
    if bash -n /tmp/install-test.sh; then
        echo "✅ Script syntax is valid"
        echo "Script first 20 lines:"
        head -20 /tmp/install-test.sh
    else
        echo "❌ Script has syntax errors"
        exit 1
    fi
else
    echo "❌ Failed to download script"
    echo "This likely means:"
    echo "  1. The repository doesn't exist on GitHub yet"
    echo "  2. The file hasn't been pushed to GitHub"
    echo "  3. The repository is private"
    echo ""
    echo "Solution: Push the code to GitHub first using:"
    echo "  ./scripts/push-to-github.sh"
    exit 1
fi
