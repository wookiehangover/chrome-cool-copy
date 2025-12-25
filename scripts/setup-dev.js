#!/usr/bin/env node

/**
 * Sets up development mode for the Chrome extension.
 * 
 * In dev mode, the sidepanel points to a local HTML file that loads
 * the Vite dev server in an iframe, enabling HMR for the chat app.
 * 
 * Usage:
 *   node scripts/setup-dev.js [--prod]
 * 
 * Options:
 *   --prod  Reset to production mode (sidepanel/index.html)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'apps/extension/dist');
const manifestPath = path.join(distDir, 'manifest.json');
const devHtmlSrc = path.join(root, 'apps/extension/src/sidepanel-dev.html');
const devHtmlDest = path.join(distDir, 'sidepanel-dev.html');

const isProd = process.argv.includes('--prod');

function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error('Error: Build the extension first with `make extension`');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (isProd) {
    // Reset to production mode
    manifest.side_panel.default_path = 'sidepanel/index.html';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Switched to production mode: sidepanel/index.html');
  } else {
    // Setup dev mode
    // Copy dev HTML to dist
    fs.copyFileSync(devHtmlSrc, devHtmlDest);
    
    // Update manifest to use dev HTML
    manifest.side_panel.default_path = 'sidepanel-dev.html';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log('Switched to dev mode: sidepanel-dev.html');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Load/reload extension from: apps/extension/dist/');
    console.log('  2. Start dev server: pnpm dev:chat');
    console.log('  3. Open the sidepanel - it will load from http://localhost:5173');
    console.log('  4. Changes will hot-reload automatically');
    console.log('');
    console.log('To switch back to production: node scripts/setup-dev.js --prod');
  }
}

main();

