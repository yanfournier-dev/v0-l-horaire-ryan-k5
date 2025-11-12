/**
 * Parse a date string or Date object in the local timezone (America/Toronto)
 * This prevents timezone conversion issues when displaying dates
 *
 * @param dateInput - Date string (YYYY-MM-DD) or Date object from database
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) {
    return getTodayInLocalTimezone()
  }

  if (dateInput instanceof Date) {
    // Extract date components in UTC (since dates from DB are in UTC)
    const year = dateInput.getUTCFullYear()
    const month = dateInput.getUTCMonth()
    const day = dateInput.getUTCDate()

    // Create a new Date in local timezone with these components
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  if (typeof dateInput !== "string") {
    return getTodayInLocalTimezone()
  }

  // If it's a string, parse it as local time using date components
  const [year, month, day] = dateInput.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Format a date for display in French Canadian format
 * Always uses UTC components to avoid timezone conversion issues
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted date string (e.g., "2025-03-10")
 */
export function formatLocalDate(dateInput: string | Date): string {
  if (typeof dateInput === "string") {
    // If it's already a string in YYYY-MM-DD format, return it
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}/)) {
      return dateInput.split("T")[0]
    }
    // Otherwise parse it first
    const date = parseLocalDate(dateInput)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const day = String(date.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // If it's a Date object from DB, use UTC methods directly
  const year = dateInput.getUTCFullYear()
  const month = String(dateInput.getUTCMonth() + 1).padStart(2, "0")
  const day = String(dateInput.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

  const offsetHours = -5
  const localTime = new Date(date.getTime() + offsetHours * 60 * 60 * 1000)

  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, "0")
  const day = String(localTime.getUTCDate()).padStart(2, "0")
  const hours = String(localTime.getUTCHours()).padStart(2, "0")
  const minutes = String(localTime.getUTCMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} à ${hours}h${minutes}`
}

function getSecondSunday(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const firstDayOfWeek = firstDay.getUTCDay()
  const firstSunday = 1 + ((7 - firstDayOfWeek) % 7)
  const secondSunday = firstSunday + 7
  return new Date(Date.UTC(year, month, secondSunday, 2, 0, 0)) // DST starts at 2am
}

function getFirstSunday(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const firstDayOfWeek = firstDay.getUTCDay()
  const firstSunday = 1 + ((7 - firstDayOfWeek) % 7)
  return new Date(Date.UTC(year, month, firstSunday, 2, 0, 0)) // DST ends at 2am
}

/**
 * Format a date for short display (e.g., "26 oct.")
 * Always uses UTC components to avoid timezone conversion issues
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted short date string (e.g., "26 oct.")
 */
export function formatShortDate(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  const day = date.getUTCDate()
  const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  const month = monthNames[date.getUTCMonth()]
  return `${day} ${month}`
}

/**
 * Get the part-time firefighter team on duty for a given date
 * Based on a 28-day cycle starting September 21, 2025 (day 1)
 *
 * Team schedule:
 * - Team 1: days 1, 23, 24, 25, 26, 27, 28
 * - Team 2: days 2, 3, 4, 5, 6, 7, 8
 * - Team 3: days 9, 10, 11, 12, 13, 14, 15
 * - Team 4: days 16, 17, 18, 19, 20, 21, 22
 *
 * @param date - The date to check (YYYY-MM-DD or Date object)
 * @returns Team number (1-4)
 */
export function getPartTimeTeam(date: string | Date): number {
  // Reference date: September 21, 2025 at midnight UTC
  const referenceDate = new Date(Date.UTC(2025, 8, 21, 0, 0, 0, 0))

  // Convert input date to UTC midnight
  const inputDate = typeof date === "string" ? new Date(date) : date
  const checkDate = new Date(
    Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate(), 0, 0, 0, 0),
  )

  // Calculate the number of days between the reference date and the check date
  const timeDiff = checkDate.getTime() - referenceDate.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))

  // Calculate the day in the 28-day cycle (1-28)
  // Add 1 because day 0 should be day 28, day 1 should be day 1, etc.
  let cycleDay = (((daysDiff % 28) + 28) % 28) + 1
  if (cycleDay === 29) cycleDay = 1

  // Determine which team is on duty based on the cycle day
  if (cycleDay === 1 || (cycleDay >= 23 && cycleDay <= 28)) {
    return 1 // Team 1: days 1, 23-28
  } else if (cycleDay >= 2 && cycleDay <= 8) {
    return 2 // Team 2: days 2-8
  } else if (cycleDay >= 9 && cycleDay <= 15) {
    return 3 // Team 3: days 9-15
  } else {
    return 4 // Team 4: days 16-22
  }
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
 * Get the current date in YYYY-MM-DD format (local timezone)
 *
 * @returns Current date string
 */
export function getCurrentLocalDate(): string {
  const now = getTodayInLocalTimezone()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/**
 * Format a creation date for subtle display
 * Always shows the exact date and time in a compact format
 * Uses local timezone automatically (handles EST/EDT)
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted creation date string (e.g., "26 oct., 14:30")
 */
export function formatCreatedAt(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput

  const offsetHours = -5
  const localTime = new Date(date.getTime() + offsetHours * 60 * 60 * 1000)

  const day = localTime.getUTCDate()
  const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  const month = monthNames[localTime.getUTCMonth()]
  const yearValue = localTime.getUTCFullYear()
  const hours = String(localTime.getUTCHours()).padStart(2, "0")
  const minutes = String(localTime.getUTCMinutes()).padStart(2, "0")

  const now = getTodayInLocalTimezone()
  const currentYear = now.getFullYear()

  if (yearValue === currentYear) {
    return `${day} ${month}, ${hours}:${minutes}`
  }

  return `${day} ${month} ${yearValue}, ${hours}:${minutes}`
}

/**
 * Format a deadline date for display
 * Returns a clear, unambiguous format like "27 octobre 2025, 17h00"
 *
 * @param deadline - Date object or ISO string
 * @returns Formatted deadline string
 */
export function formatDeadlineForDisplay(deadline: string | Date): string {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline

  // Use Intl.DateTimeFormat for localized date formatting
  const dateFormatter = new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const timeFormatter = new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}

/**
 * Format a Date object to YYYY-MM-DD string using local timezone
 * Use this instead of toISOString() to avoid timezone conversion issues
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Calculate the automatic deadline for a replacement
 * The deadline is the Monday of the previous week at 5pm (17:00) local time
 *
 * @param shiftDate - The date of the shift (YYYY-MM-DD or Date object)
 * @returns Date object representing the deadline
 *
 * @example
 * // For a shift on Wednesday, November 5, 2025
 * calculateAutoDeadline("2025-11-05")
 * // Returns: Monday, October 27, 2025 at 17:00
 */
export function calculateAutoDeadline(shiftDate: string | Date): Date {
  const shift = typeof shiftDate === "string" ? parseLocalDate(shiftDate) : shiftDate

  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = shift.getDay()

  // Calculate days to subtract to get to Monday of the shift's week
  // If Sunday (0), go back 6 days; if Monday (1), go back 0 days; etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // Get Monday of the shift's week
  const mondayOfShiftWeek = new Date(shift)
  mondayOfShiftWeek.setDate(shift.getDate() - daysToMonday)

  // Subtract 7 days to get Monday of the previous week
  const mondayOfPreviousWeek = new Date(mondayOfShiftWeek)
  mondayOfPreviousWeek.setDate(mondayOfShiftWeek.getDate() - 7)

  // Set time to 17:00 (5pm) local time
  mondayOfPreviousWeek.setHours(17, 0, 0, 0)

  return mondayOfPreviousWeek
}

/**
 * Get today's date in the correct timezone
 * In production (Vercel), server runs in UTC, so we adjust for America/Montreal (UTC-5)
 * In V0 preview, we use the default timezone
 *
 * @returns Date object representing today in local timezone
 */
export function getTodayInLocalTimezone(): Date {
  const now = new Date()

  const isV0Preview = typeof window !== "undefined" && window.location.hostname.includes("v0.app")
  const isProduction = !isV0Preview

  if (isProduction) {
    // Adjust UTC time to Montreal time (UTC-5)
    const montrealTime = new Date(now.getTime() - 5 * 60 * 60 * 1000)

    // Create a date at midnight in Montreal timezone
    const result = new Date(
      montrealTime.getUTCFullYear(),
      montrealTime.getUTCMonth(),
      montrealTime.getUTCDate(),
      0,
      0,
      0,
      0,
    )

    return result
  }

  // In V0 or other environments, use default behavior
  return new Date()
}
