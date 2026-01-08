# Secure AI Chat - Setup Script for Windows PowerShell
# This script automates the installation and environment setup

Write-Host "🚀 Secure AI Chat - Setup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
$nodeMajorVersion = (node -v).Substring(1).Split('.')[0]
if ([int]$nodeMajorVersion -lt 18) {
    Write-Host "❌ Error: Node.js version 18+ is required. Current version: $(node -v)" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm -v
    Write-Host "✅ npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: npm is not installed." -ForegroundColor Red
    Write-Host "npm usually comes with Node.js. If Node.js is installed but npm is missing," -ForegroundColor Yellow
    Write-Host "please reinstall Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Install dependencies - use npm ci if package-lock.json exists, otherwise npm install
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
if (Test-Path package-lock.json) {
    Write-Host "Using 'npm ci' for reproducible builds (package-lock.json detected)..." -ForegroundColor Cyan
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: 'npm ci' failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "This usually means package-lock.json is out of sync with package.json" -ForegroundColor Yellow
        Write-Host "Try running 'npm install' to update package-lock.json, then commit it" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Using 'npm install' (no package-lock.json found)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Failed to install dependencies (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Check your internet connection and npm registry access" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Check if .env.local exists
if (-Not (Test-Path .env.local)) {
    Write-Host "📝 Creating .env.local from .env.example..." -ForegroundColor Yellow
    if (Test-Path .env.example) {
        Copy-Item .env.example .env.local
        Write-Host "✅ Created .env.local" -ForegroundColor Green
        Write-Host "⚠️  Please edit .env.local and add your API keys" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  Warning: .env.example not found. Creating basic .env.local..." -ForegroundColor Yellow
        @"
# Secure AI Chat - Environment Variables
# Add your API keys here

OPENAI_API_KEY=
LAKERA_AI_KEY=
LAKERA_ENDPOINT=https://api.lakera.ai/v2/guard
LAKERA_PROJECT_ID=
NEXT_PUBLIC_APP_NAME=Secure AI Chat
NEXT_PUBLIC_APP_VERSION=0.1.0
PORT=3000
"@ | Out-File -FilePath .env.local -Encoding utf8
        Write-Host "✅ Created .env.local" -ForegroundColor Green
        Write-Host "⚠️  Please edit .env.local and add your API keys" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  .env.local already exists, skipping..." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Edit .env.local and add your API keys"
Write-Host "2. Run 'npm run dev' to start the development server"
Write-Host "3. Open http://localhost:3000 in your browser"
Write-Host ""
Write-Host "Note: API keys can also be configured through the Settings page in the application."
Write-Host ""
