#!/usr/bin/env node

/**
 * Generate version.ts based on current timestamp
 * This script is run before every build
 * Uses Eastern Time (EST/EDT) - auto-adjusts for daylight saving
 */

const fs = require('fs');
const path = require('path');

// Get current date and time in Eastern Time (EST/EDT)
const now = new Date();
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Toronto', // Auto-handles EST/EDT
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const parts = formatter.formatToParts(now);
const dateParts = {};
parts.forEach(part => {
  dateParts[part.type] = part.value;
});

// Generate version string in format: vYYMMDD.HHMM
const version = `v${dateParts.year}${dateParts.month}${dateParts.day}.${dateParts.hour}${dateParts.minute}`;

// Content for version.ts
const versionContent = `/**
 * Auto-generated version file
 * Generated at: ${now.toISOString()} (Eastern Time)
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
