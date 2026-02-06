#!/usr/bin/env node
/**
 * Start script: use standalone server when output: 'standalone' was built,
 * otherwise fall back to "next start". Fixes Next.js warning:
 * "next start" does not work with "output: standalone" configuration.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const serverJs = path.join(standaloneDir, 'server.js');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function runStandalone() {
  const staticSrc = path.join(projectRoot, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicSrc = path.join(projectRoot, 'public');
  const publicDest = path.join(standaloneDir, 'public');

  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    copyDirSync(staticSrc, staticDest);
  }
  if (fs.existsSync(publicSrc)) {
    copyDirSync(publicSrc, publicDest);
  }

  const child = spawn(process.execPath, ['server.js'], {
    stdio: 'inherit',
    cwd: standaloneDir,
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function runNextStart() {
  const nextBin = path.join(projectRoot, 'node_modules', '.bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start'], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (fs.existsSync(serverJs)) {
  runStandalone();
} else {
  runNextStart();
}
