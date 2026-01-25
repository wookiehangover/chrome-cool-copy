import { execSync } from 'child_process';
import * as fs from 'fs';
import { platform } from 'os';
import * as path from 'path';

if (platform() === 'darwin') {
  console.log('Building Safari extension...');
  try {
    const SAFARI_DIR = path.resolve(process.cwd());
    const EXTENSION_DIST = path.resolve(process.cwd(), '../extension/dist');
    const SAFARI_DIST = path.resolve(SAFARI_DIR, 'dist');

    // Check if the extension dist folder exists
    if (!fs.existsSync(EXTENSION_DIST)) {
      throw new Error(
        `Extension dist folder not found at ${EXTENSION_DIST}. Run the extension build first.`
      );
    }

    // Remove existing dist folder if present
    if (fs.existsSync(SAFARI_DIST)) {
      console.log('Removing existing dist folder...');
      fs.rmSync(SAFARI_DIST, { recursive: true });
    }

    // Copy extension dist to safari dist
    console.log(`Copying extension dist from ${EXTENSION_DIST} to ${SAFARI_DIST}...`);
    fs.cpSync(EXTENSION_DIST, SAFARI_DIST, { recursive: true });
    console.log('Extension dist copied successfully.');

    // Run the safari-web-extension-converter
    console.log('Running safari-web-extension-converter...');
    execSync('npm run convert', { stdio: 'inherit', cwd: SAFARI_DIR });

    console.log('Safari extension build complete!');
  } catch (error) {
    console.error('Failed to build Safari extension:', error);
    process.exit(1);
  }
} else {
  console.log('Skipping Safari extension build - requires macOS');
}

