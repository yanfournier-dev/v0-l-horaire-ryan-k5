"use server"

import { sql } from "@/lib/db"

interface ShiftInfo {
  date: Date
  shiftType: string
  startTime?: string
  endTime?: string
  isPartial: boolean
}

/**
 * Calculate the duration of a shift in hours
 */
function calculateShiftDuration(shiftType: string, isPartial: boolean, startTime?: string, endTime?: string): number {
  if (isPartial && startTime && endTime) {
    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)

    let duration = endHour - startHour + (endMinute - startMinute) / 60

    // Handle overnight shifts
    if (duration < 0) {
      duration += 24
    }

    return duration
  }

  // Standard shift durations
  switch (shiftType) {
    case "full_24h":
      return 24
    case "day":
      return 10
    case "night":
      return 14
    default:
      return 0
  }
}

/**
 * Get the end datetime of a shift
 */
function getShiftEnd(date: Date, shiftType: string, isPartial: boolean, endTime?: string, startTime?: string): Date {
  const endDate = new Date(date)

  if (isPartial && endTime) {
    const [endHour, endMinute] = endTime.split(":").map(Number)
    endDate.setHours(endHour, endMinute, 0, 0)

    // If this is a partial night shift (end time is before start time, meaning it goes to next day)
    if (startTime) {
      const [startHour] = startTime.split(":").map(Number)
      if (endHour < startHour) {
        // End time is on the next day
        endDate.setDate(endDate.getDate() + 1)
      }
    }

    return endDate
  }

  // Standard shift end times
  switch (shiftType) {
    case "full_24h":
      endDate.setDate(endDate.getDate() + 1)
      endDate.setHours(7, 0, 0, 0)
      return endDate
    case "day":
      endDate.setHours(17, 0, 0, 0)
      return endDate
    case "night":
      endDate.setDate(endDate.getDate() + 1)
      endDate.setHours(7, 0, 0, 0)
      return endDate
    default:
      return endDate
  }
}

/**
 * Get the start datetime of a shift
 */
function getShiftStart(date: Date, shiftType: string, isPartial: boolean, startTime?: string): Date {
  const startDate = new Date(date)

  if (isPartial && startTime) {
    const [startHour, startMinute] = startTime.split(":").map(Number)
    startDate.setHours(startHour, startMinute, 0, 0)
    return startDate
  }

  // Standard shift start times
  switch (shiftType) {
    case "full_24h":
    case "day":
      startDate.setHours(7, 0, 0, 0)
      return startDate
    case "night":
      startDate.setHours(17, 0, 0, 0)
      return startDate
    default:
      return startDate
  }
}

/**
 * Check if adding a new shift would cause a firefighter to work more than 38 consecutive hours
 * Returns { exceeds: boolean, totalHours: number, message?: string }
 */
export async function checkConsecutiveHours(
  userId: number,
  newShiftDate: string, // YYYY-MM-DD format
  newShiftType: string,
  isPartial = false,
  startTime?: string,
  endTime?: string,
): Promise<{ exceeds: boolean; totalHours: number; message?: string }> {
  console.log("[v0] checkConsecutiveHours called for user:", userId, "date:", newShiftDate, "type:", newShiftType)

  try {
    const newDate = new Date(newShiftDate + "T00:00:00")

    // Get date range: 2 days before and 2 days after
    const startRange = new Date(newDate)
    startRange.setDate(startRange.getDate() - 2)
    const endRange = new Date(newDate)
    endRange.setDate(endRange.getDate() + 2)

    const startRangeStr = startRange.toISOString().split("T")[0]
    const endRangeStr = endRange.toISOString().split("T")[0]

    console.log("[v0] Checking shifts in range:", startRangeStr, "to", endRangeStr)

    const cycleConfig = await sql`
      SELECT start_date, cycle_length_days
      FROM cycle_config
      WHERE is_active = true
      LIMIT 1
    `

    if (cycleConfig.length === 0) {
      console.log("[v0] No active cycle config found")
      return { exceeds: false, totalHours: 0, message: "Configuration du cycle non trouvée" }
    }

    const { start_date, cycle_length_days } = cycleConfig[0]
    const cycleStartDate = new Date(start_date)

    const userTeam = await sql`
      SELECT tm.team_id 
      FROM team_members tm
      WHERE tm.user_id = ${userId} 
      LIMIT 1
    `

    if (userTeam.length === 0) {
      console.log("[v0] User not found or not in a team:", userId)
      return { exceeds: false, totalHours: 0, message: "Utilisateur non trouvé ou pas assigné à une équipe" }
    }

    const teamId = userTeam[0].team_id

    const regularShifts = await sql`
      SELECT cycle_day, shift_type
      FROM shifts
      WHERE team_id = ${teamId}
    `

    console.log("[v0] Found", regularShifts.length, "regular shifts for team", teamId)

    const regularShiftsInRange: Array<{ shift_date: string; shift_type: string; is_partial: boolean }> = []

    for (const shift of regularShifts) {
      // Calculate all occurrences of this cycle_day in our date range
      const checkDate = new Date(startRange)

      while (checkDate <= endRange) {
        const daysSinceStart = Math.floor((checkDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24))
        const currentCycleDay = (daysSinceStart % cycle_length_days) + 1

        if (currentCycleDay === shift.cycle_day) {
          const dateStr = checkDate.toISOString().split("T")[0]
          regularShiftsInRange.push({
            shift_date: dateStr,
            shift_type: shift.shift_type,
            is_partial: false,
          })
        }

        checkDate.setDate(checkDate.getDate() + 1)
      }
    }

    console.log("[v0] Regular shifts in range:", regularShiftsInRange.length)

    // Get all other shifts for this user in the range (replacements, direct assignments, exchanges)
    const otherShifts = await sql`
      WITH user_other_shifts AS (
        -- Replacements (status = 'assigned')
        SELECT 
          r.shift_type,
          r.is_partial,
          r.start_time,
          r.end_time,
          r.shift_date::text as shift_date
        FROM replacements r
        JOIN replacement_applications ra ON r.id = ra.replacement_id
        WHERE ra.applicant_id = ${userId}
          AND ra.status = 'approved'
          AND r.status = 'assigned'
          AND r.shift_date >= ${startRangeStr}
          AND r.shift_date <= ${endRangeStr}
        
        UNION ALL
        
        -- Direct assignments (need to calculate dates from cycle_day)
        SELECT 
          s.shift_type,
          sa.is_partial,
          sa.start_time,
          sa.end_time,
          sa.shift_date::text as shift_date
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ${userId}
          AND sa.is_direct_assignment = TRUE
          AND sa.shift_date >= ${startRangeStr}
          AND sa.shift_date <= ${endRangeStr}
        
        UNION ALL
        
        -- Approved exchanges (user takes someone else's shift)
        SELECT 
          se.target_shift_type as shift_type,
          se.is_partial,
          se.target_start_time as start_time,
          se.target_end_time as end_time,
          se.target_shift_date::text as shift_date
        FROM shift_exchanges se
        WHERE se.requester_id = ${userId}
          AND se.status = 'approved'
          AND se.target_shift_date >= ${startRangeStr}
          AND se.target_shift_date <= ${endRangeStr}
        
        UNION ALL
        
        SELECT 
          se.requester_shift_type as shift_type,
          se.is_partial,
          se.requester_start_time as start_time,
          se.requester_end_time as end_time,
          se.requester_shift_date::text as shift_date
        FROM shift_exchanges se
        WHERE se.target_id = ${userId}
          AND se.status = 'approved'
          AND se.requester_shift_date >= ${startRangeStr}
          AND se.requester_shift_date <= ${endRangeStr}
      )
      SELECT * FROM user_other_shifts
    `

    console.log("[v0] Found", otherShifts.length, "other shifts (replacements/direct/exchanges)")

    const allShiftsData = [
      ...regularShiftsInRange,
      ...otherShifts.map((s) => ({
        shift_date: s.shift_date,
        shift_type: s.shift_type,
        is_partial: s.is_partial,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    ]

    console.log("[v0] Total shifts found:", allShiftsData.length)

    // Convert all shifts to actual dates with start/end times
    const allShifts: Array<{ start: Date; end: Date; hours: number }> = []

    for (const shift of allShiftsData) {
      const shiftDate = new Date(shift.shift_date + "T00:00:00")
      const start = getShiftStart(shiftDate, shift.shift_type, shift.is_partial, shift.start_time)
      const end = getShiftEnd(shiftDate, shift.shift_type, shift.is_partial, shift.end_time, shift.start_time)
      const hours = calculateShiftDuration(shift.shift_type, shift.is_partial, shift.start_time, shift.end_time)

      allShifts.push({ start, end, hours })
    }

    // Add the new shift
    const newStart = getShiftStart(newDate, newShiftType, isPartial, startTime)
    const newEnd = getShiftEnd(newDate, newShiftType, isPartial, endTime, startTime)
    const newHours = calculateShiftDuration(newShiftType, isPartial, startTime, endTime)

    allShifts.push({ start: newStart, end: newEnd, hours: newHours })

    console.log("[v0] Total shifts to analyze (including new):", allShifts.length)

    // Sort by start time
    allShifts.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Calculate consecutive hours
    let maxConsecutive = 0
    let currentConsecutive = 0
    let currentEnd: Date | null = null

    for (const shift of allShifts) {
      if (currentEnd === null) {
        // First shift
        currentConsecutive = shift.hours
        currentEnd = shift.end
      } else {
        // Check gap between previous end and current start
        const gapHours = (shift.start.getTime() - currentEnd.getTime()) / (1000 * 60 * 60)

        if (gapHours < 8) {
          // Consecutive! Add hours
          currentConsecutive += shift.hours
          currentEnd = shift.end
        } else {
          // Break in sequence, reset
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
          currentConsecutive = shift.hours
          currentEnd = shift.end
        }
      }
    }

    maxConsecutive = Math.max(maxConsecutive, currentConsecutive)

    const exceeds = maxConsecutive > 38

    console.log("[v0] Max consecutive hours:", maxConsecutive, "exceeds 38h:", exceeds)

    return {
      exceeds,
      totalHours: Math.round(maxConsecutive * 10) / 10, // Round to 1 decimal
      message: exceeds
        ? `Ce pompier travaillerait ${maxConsecutive.toFixed(1)}h consécutives, ce qui dépasse la limite de 38h.`
        : undefined,
    }
  } catch (error) {
    console.error("[v0] checkConsecutiveHours error:", error)
    return { exceeds: false, totalHours: 0, message: "Erreur lors de la vérification" }
  }
}
