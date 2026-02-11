#!/usr/bin/env node

/**
 * Generate version.ts based on current timestamp
 * This script is run before every build
 */

const fs = require('fs');
const path = require('path');

// Get current date and time
const now = new Date();
const year = now.getFullYear().toString().slice(-2);
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');

// Generate version string
const version = `v${year}${month}${day}.${hours}${minutes}`;

// Content for version.ts
const versionContent = `/**
 * Auto-generated version file
 * Generated at: ${now.toISOString()}
 */

export const APP_VERSION = '${version}';
`;

// Write the file - use process.cwd() to get the root directory
const versionPath = path.join(process.cwd(), 'lib', 'version.ts');

try {
  // Ensure lib directory exists
  const libDir = path.join(process.cwd(), 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  fs.writeFileSync(versionPath, versionContent);
  console.log(`✓ Version file generated: ${version}`);
} catch (error) {
  console.error('✗ Failed to generate version file:', error);
  process.exit(1);
}
