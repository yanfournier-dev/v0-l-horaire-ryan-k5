/**
 * Version generator - generates version at runtime in v0, at build time on Vercel
 * Format: vYYMMDD.HHMM (Eastern Time)
 */

export function getAPP_VERSION(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  parts.forEach(part => {
    dateParts[part.type] = part.value;
  });

  return `v${dateParts.year}${dateParts.month}${dateParts.day}.${dateParts.hour}${dateParts.minute}`;
}

export const APP_VERSION = getAPP_VERSION();
