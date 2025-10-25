/**
 * Utility functions for sorting shifts consistently across the application.
 * Day shifts should always appear before night shifts for the same date.
 */

/**
 * Get sort priority for shift types
 * Lower numbers appear first
 */
export function getShiftTypeSortPriority(shiftType: string): number {
  switch (shiftType) {
    case "day":
      return 1 // Day shifts first
    case "night":
      return 2 // Night shifts second
    case "full_24h":
      return 3 // 24h shifts last
    default:
      return 4 // Unknown types at the end
  }
}

/**
 * Compare two shifts for sorting
 * Sorts by: date (ascending), then shift type (day before night)
 */
export function compareShifts(
  a: { shift_date: string; shift_type: string },
  b: { shift_date: string; shift_type: string },
  dateParser: (date: string) => Date,
): number {
  // First, compare by date
  const dateA = dateParser(a.shift_date).getTime()
  const dateB = dateParser(b.shift_date).getTime()

  if (dateA !== dateB) {
    return dateA - dateB
  }

  // If dates are equal, compare by shift type priority
  return getShiftTypeSortPriority(a.shift_type) - getShiftTypeSortPriority(b.shift_type)
}
