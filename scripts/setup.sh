#!/bin/bash

# Secure AI Chat - Setup Script for Unix/Linux/macOS
# This script automates the installation and environment setup

set -e

echo "🚀 Secure AI Chat - Setup Script"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    echo "npm usually comes with Node.js. If Node.js is installed but npm is missing,"
    echo "please reinstall Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Install dependencies - use npm ci if package-lock.json exists, otherwise npm install
echo "📦 Installing dependencies..."
if [ -f "package-lock.json" ]; then
    echo "Using 'npm ci' for reproducible builds (package-lock.json detected)..."
    npm ci
    INSTALL_EXIT_CODE=$?
    if [ $INSTALL_EXIT_CODE -ne 0 ]; then
        echo "❌ Error: 'npm ci' failed (exit code: $INSTALL_EXIT_CODE)"
        echo "This usually means package-lock.json is out of sync with package.json"
        echo "Try running 'npm install' to update package-lock.json, then commit it"
        exit 1
    fi
else
    echo "Using 'npm install' (no package-lock.json found)..."
    npm install
    INSTALL_EXIT_CODE=$?
    if [ $INSTALL_EXIT_CODE -ne 0 ]; then
        echo "❌ Error: Failed to install dependencies (exit code: $INSTALL_EXIT_CODE)"
        echo "Check your internet connection and npm registry access"
        exit 1
    fi
fi

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local"
        echo "⚠️  Please edit .env.local and add your API keys"
    else
        echo "⚠️  Warning: .env.example not found. Creating basic .env.local..."
        cat > .env.local << EOF
# Secure AI Chat - Environment Variables
# Add your API keys here

OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=0.1.0
PORT=3000
EOF
        echo "✅ Created .env.local"
        echo "⚠️  Please edit .env.local and add your API keys"
    fi
else
    echo "ℹ️  .env.local already exists, skipping..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and add your API keys"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Note: API keys can also be configured through the Settings page in the application."
echo ""
