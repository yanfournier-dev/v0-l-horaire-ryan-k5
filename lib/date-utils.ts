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
 * Uses Intl.DateTimeFormat to handle timezone automatically (EST/EDT)
 *
 * @param dateInput - Date string or Date object from database (assumed to be in UTC)
 * @returns Formatted date and time string (e.g., "2025-11-29 à 14h30")
 */
export function formatLocalDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) {
    return ""
  }

  const date = new Date(dateInput)

  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(/(\d{4})-(\d{2})-(\d{2}),?\s*(\d{2}):(\d{2})/, "$1-$2-$3 à $4h$5")
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

  const yearValue = date.getFullYear()
  const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  const month = monthNames[date.getMonth()]
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

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
 * The deadline is the Monday of the previous week at 5pm (17:00) America/Toronto time
 *
 * @param shiftDate - The date of the shift (YYYY-MM-DD or Date object)
 * @returns Date object representing the deadline in UTC
 *
 * @example
 * // For a shift on Wednesday, November 5, 2025
 * calculateAutoDeadline("2025-11-05")
 * // Returns: Monday, October 27, 2025 at 17:00 America/Toronto (22:00 UTC in winter)
 */
export function calculateAutoDeadline(shiftDate: string | Date): Date {
  const shift = typeof shiftDate === "string" ? parseLocalDate(shiftDate) : shiftDate

  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = shift.getDay()

  // Calculate days to subtract to get to Monday of the shift's week
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // Get Monday of the shift's week
  const mondayOfShiftWeek = new Date(shift)
  mondayOfShiftWeek.setDate(shift.getDate() - daysToMonday)

  // Subtract 7 days to get Monday of the previous week
  const mondayOfPreviousWeek = new Date(mondayOfShiftWeek)
  mondayOfPreviousWeek.setDate(mondayOfShiftWeek.getDate() - 7)

  // Format as YYYY-MM-DD for the Monday date
  const year = mondayOfPreviousWeek.getFullYear()
  const month = String(mondayOfPreviousWeek.getMonth() + 1).padStart(2, "0")
  const day = String(mondayOfPreviousWeek.getDate()).padStart(2, "0")
  const dateString = `${year}-${month}-${day}`

  // Create a date string for 17:00 in America/Toronto timezone
  // Use Intl.DateTimeFormat to determine if DST is in effect
  const testDate = new Date(`${dateString}T12:00:00-05:00`) // Noon EST
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "short",
  })
  const parts = formatter.formatToParts(testDate)
  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value || "EST"

  // Determine UTC offset based on timezone name
  // EDT (Eastern Daylight Time) = UTC-4
  // EST (Eastern Standard Time) = UTC-5
  const offset =
    timeZoneName.includes("EDT") || (timeZoneName.includes("E") && !timeZoneName.includes("S")) ? "-04:00" : "-05:00"

  // Create UTC date for 17:00 in America/Toronto
  const deadlineUTC = new Date(`${dateString}T17:00:00${offset}`)

  return deadlineUTC
}

/**
 * Calculate the deadline as the end time of the shift
 * Used for "Premier arrivé, premier servi" option
 *
 * @param shiftDate - The date of the shift (YYYY-MM-DD or Date object)
 * @param endTime - The end time of the shift (HH:MM:SS or HH:MM)
 * @param startTime - The start time of the shift (HH:MM:SS or HH:MM)
 * @returns Date object representing the deadline (end of shift)
 *
 * @example
 * // For a day shift on December 25, 2025 ending at 17:00
 * calculateEndOfShiftDeadline("2025-12-25", "17:00:00")
 * // Returns: December 25, 2025 at 17:00
 *
 * // For a night shift on December 25, 2025 starting at 17:00 and ending at 07:00
 * calculateEndOfShiftDeadline("2025-12-25", "07:00:00", "17:00:00")
 * // Returns: December 26, 2025 at 07:00 (next day)
 *
 * // For a 24h shift on December 25, 2025 starting at 07:00 and ending at 07:00
 * calculateEndOfShiftDeadline("2025-12-25", "07:00:00", "07:00:00")
 * // Returns: December 26, 2025 at 07:00 (next day)
 */
export function calculateEndOfShiftDeadline(shiftDate: string | Date, endTime: string, startTime?: string): Date {
  const shift = typeof shiftDate === "string" ? parseLocalDate(shiftDate) : shiftDate

  // Extract hours and minutes from times (handle both HH:MM:SS and HH:MM formats)
  const [endHours, endMinutes] = endTime.split(":").map(Number)

  let needsNextDay = false
  if (startTime) {
    const [startHours] = startTime.split(":").map(Number)
    // This handles both night shifts (17h-7h) and 24h shifts (7h-7h)
    if (endHours <= startHours) {
      needsNextDay = true
    }
  }

  // Create deadline at the end time of the shift
  const deadline = new Date(shift)
  deadline.setHours(endHours, endMinutes, 0, 0)

  // Add one day if needed for night shifts or 24h shifts
  if (needsNextDay) {
    deadline.setDate(deadline.getDate() + 1)
  }

  return deadline
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
  return now
}

/**
 * Calculate the deadline as the end time of the shift
 * Used for "Sans délai" option
 *
 * @param shiftDate - The date of the shift (YYYY-MM-DD or Date object)
 * @param endTime - The end time of the shift (HH:MM:SS or HH:MM)
 * @returns Date object representing the deadline (end of shift)
 *
 * @example
 * // For a day shift on December 25, 2025 ending at 17:00
 * calculateEndOfShiftDeadlineSansDélai("2025-12-25", "17:00:00")
 * // Returns: December 25, 2025 at 17:00
 *
 * // For a night shift on December 25, 2025 starting at 17:00 and ending at 07:00
 * calculateEndOfShiftDeadlineSansDélai("2025-12-25", "07:00:00", "17:00:00")
 * // Returns: December 26, 2025 at 07:00 (next day)
 *
 * // For a 24h shift on December 25, 2025 starting at 07:00 and ending at 07:00
 * calculateEndOfShiftDeadlineSansDélai("2025-12-25", "07:00:00", "07:00:00")
 * // Returns: December 26, 2025 at 07:00 (next day)
 */
export function calculateEndOfShiftDeadlineSansDélai(shiftDate: string | Date, endTime: string): Date {
  const shift = typeof shiftDate === "string" ? parseLocalDate(shiftDate) : shiftDate

  // Extract hours and minutes from times (handle both HH:MM:SS and HH:MM formats)
  const [endHours, endMinutes] = endTime.split(":").map(Number)

  // Create deadline at the end time of the shift
  const deadline = new Date(shift)
  deadline.setHours(endHours, endMinutes, 0, 0)

  return deadline
}
