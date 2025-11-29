// Calculate which day of the 28-day cycle a given date falls on
export function getCycleDay(date: Date, cycleStartDate: Date): number {
  const diffTime = date.getTime() - cycleStartDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return (diffDays % 28) + 1
}

// Get the date for a specific cycle day
export function getDateForCycleDay(cycleDay: number, cycleStartDate: Date, currentDate: Date): Date {
  const currentCycleDay = getCycleDay(currentDate, cycleStartDate)
  const daysToAdd = cycleDay - currentCycleDay

  const targetDate = new Date(currentDate)
  targetDate.setDate(targetDate.getDate() + daysToAdd)

  return targetDate
}

// Generate 28 days starting from a given date
export function generate28DayCycle(startDate: Date, cycleStartDate: Date) {
  const days = []

  for (let i = 0; i < 28; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    const cycleDay = getCycleDay(date, cycleStartDate)

    days.push({
      date,
      cycleDay,
      dayOfWeek: date.getDay(),
      isToday: isToday(date),
    })
  }

  return days
}

import { getTodayInLocalTimezone } from "@/lib/date-utils"

function isToday(date: Date): boolean {
  const today = getTodayInLocalTimezone()

  // Use UTC methods for comparison to avoid double timezone conversion
  return (
    date.getUTCDate() === today.getUTCDate() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCFullYear() === today.getUTCFullYear()
  )
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function generateMonthView(year: number, month: number, cycleStartDate: Date) {
  const days = []

  const lastDay = new Date(year, month + 1, 0)

  // Add all days of the current month only
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day, 12, 0, 0, 0)
    const cycleDay = getCycleDay(date, cycleStartDate)
    days.push({
      date,
      cycleDay,
      dayOfWeek: date.getDay(),
      isToday: isToday(date),
      isCurrentMonth: true,
      isFirstDayOfMonth: day === 1, // Mark first day of month
    })
  }

  return days
}

export function getMonthName(month: number): string {
  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ]
  return months[month]
}

/**
 * Parse a date string or Date object in the local timezone
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
    // Extract date components in UTC (since dates from DB are in UTC)
    const year = dateInput.getUTCFullYear()
    const month = dateInput.getUTCMonth()
    const day = dateInput.getUTCDate()

    // Create a new Date in local timezone with these components
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  if (typeof dateInput !== "string") {
    return new Date()
  }

  // Parse string as local time using date components
  const [year, month, day] = dateInput.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}
