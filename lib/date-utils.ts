/**
 * Parse a date string or Date object in the local timezone (America/Toronto)
 * This prevents timezone conversion issues when displaying dates
 *
 * @param dateInput - Date string (YYYY-MM-DD) or Date object from database
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) {
    return new Date()
  }

  if (dateInput instanceof Date) {
    // If it's already a Date object, create a new date from its ISO string
    // but interpret it as local time
    const isoString = dateInput.toISOString().split("T")[0]
    return new Date(isoString + "T00:00:00")
  }

  if (typeof dateInput !== "string") {
    return new Date()
  }

  // If it's a string, ensure it's interpreted as local time
  // by adding the time component
  return new Date(dateInput + "T00:00:00")
}

/**
 * Format a date for display in French Canadian format
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted date string (e.g., "2025-03-10")
 */
export function formatLocalDate(dateInput: string | Date): string {
  const date = parseLocalDate(dateInput)
  return date.toLocaleDateString("fr-CA")
}

/**
 * Get the current date in YYYY-MM-DD format (local timezone)
 *
 * @returns Current date string
 */
export function getCurrentLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Compare two dates (ignoring time component)
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: string | Date | null | undefined, date2: string | Date | null | undefined): number {
  const d1 = parseLocalDate(date1)
  const d2 = parseLocalDate(date2)

  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)

  if (d1 < d2) return -1
  if (d1 > d2) return 1
  return 0
}

/**
 * Format a date and time for display in French Canadian format
 * Handles timezone conversion to display local time correctly
 *
 * @param dateInput - Date string or Date object from database
 * @returns Formatted date and time string (e.g., "2025-03-10 à 14:30")
 */
export function formatLocalDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) {
    return ""
  }

  const date = new Date(dateInput)

  date.setHours(date.getHours() - 4)

  // Get local date components
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} à ${hours}:${minutes}`
}
