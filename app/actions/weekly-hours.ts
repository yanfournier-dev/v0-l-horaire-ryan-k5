"use server"

import { sql } from "@/lib/db"
import { parseLocalDate } from "@/lib/date-utils"

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 0 : -day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of the week (Saturday) for a given date
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Calculate the cycle day for a given date
 */
function getCycleDay(date: Date, cycleStartDate: Date, cycleLengthDays: number): number {
  const diffTime = date.getTime() - cycleStartDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return (diffDays % cycleLengthDays) + 1
}

/**
 * Calculate hours for a shift
 */
function calculateShiftHours(
  shiftType: string,
  isPartial: boolean,
  startTime: string | null,
  endTime: string | null,
): number {
  if (isPartial && startTime && endTime) {
    const [startHour, startMin] = startTime.split(":").map(Number)
    const [endHour, endMin] = endTime.split(":").map(Number)
    return endHour - startHour + (endMin - startMin) / 60
  }

  switch (shiftType) {
    case "day":
      return 10
    case "night":
      return 14
    case "full_24h":
      return 24
    default:
      return 0
  }
}

/**
 * Calculate the total scheduled hours for a firefighter in a given week
 * Week starts on Sunday and ends on Saturday
 * Saturday night shift counts as 14h on Saturday (no hours on Sunday)
 *
 * @param userId - The firefighter's user ID
 * @param weekDate - Any date within the week to calculate hours for
 * @returns Total scheduled hours for the week
 */
export async function getFirefighterWeeklyHours(userId: number, weekDate: string | Date): Promise<number> {
  try {
    const date = parseLocalDate(weekDate)
    const weekStart = getWeekStart(date)
    const weekEnd = getWeekEnd(date)

    const weekStartStr = formatDateStr(weekStart)
    const weekEndStr = formatDateStr(weekEnd)

    const userTeam = await sql`
      SELECT t.type
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ${userId}
        AND t.type = 'permanent'
      LIMIT 1
    `

    const isPermanentFirefighter = userTeam.length > 0

    const [cycleConfig, teams] = await Promise.all([
      sql`
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      `,
      sql`
        SELECT team_id
        FROM team_members
        WHERE user_id = ${userId}
      `,
    ])

    if (cycleConfig.length === 0 || teams.length === 0) {
      return isPermanentFirefighter ? 42 : 0
    }

    const { start_date, cycle_length_days } = cycleConfig[0]
    const cycleStartDate = parseLocalDate(start_date)
    const teamIds = teams.map((t: any) => t.team_id)

    // Calculate cycle days for the entire week
    const cycleDays: number[] = []
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart)
      currentDate.setDate(weekStart.getDate() + i)
      cycleDays.push(getCycleDay(currentDate, cycleStartDate, cycle_length_days))
    }

    const [regularShifts, replacementShifts, extraAssignments] = await Promise.all([
      sql`
        SELECT shift_type, cycle_day
        FROM shifts
        WHERE team_id = ANY(${teamIds})
          AND cycle_day = ANY(${cycleDays})
      `,
      sql`
        SELECT r.shift_type, r.is_partial, r.start_time, r.end_time, r.shift_date
        FROM replacements r
        JOIN replacement_applications ra ON r.id = ra.replacement_id
        WHERE ra.applicant_id = ${userId}
          AND ra.status = 'approved'
          AND r.status = 'assigned'
          AND r.shift_date >= ${weekStartStr}
          AND r.shift_date <= ${weekEndStr}
      `,
      sql`
        SELECT sa.is_partial, sa.start_time, sa.end_time, s.shift_type, s.cycle_day
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ${userId}
          AND sa.is_extra = true
          AND s.cycle_day = ANY(${cycleDays})
      `,
    ])

    let totalHours = 0

    // For non-permanent, calculate regular shifts + replacements/extras
    if (isPermanentFirefighter) {
      totalHours = 42
    } else {
      for (const shift of regularShifts) {
        totalHours += calculateShiftHours(shift.shift_type, false, null, null)
      }
    }

    for (const shift of replacementShifts) {
      totalHours += calculateShiftHours(shift.shift_type, shift.is_partial, shift.start_time, shift.end_time)
    }

    for (const assignment of extraAssignments) {
      totalHours += calculateShiftHours(
        assignment.shift_type,
        assignment.is_partial,
        assignment.start_time,
        assignment.end_time,
      )
    }

    return totalHours
  } catch (error) {
    console.error("[v0] getFirefighterWeeklyHours: Error:", error)
    return 0
  }
}

/**
 * Calculate the total scheduled hours for multiple firefighters in a given week
 * This is an optimized version that fetches data for all firefighters in batch
 * to reduce the number of database queries
 *
 * @param userIds - Array of firefighter user IDs
 * @param weekDate - Any date within the week to calculate hours for
 * @returns Map of user ID to total scheduled hours for the week
 */
export async function getBatchFirefighterWeeklyHours(
  userIds: number[],
  weekDate: string | Date,
): Promise<Map<number, number>> {
  const hoursMap = new Map<number, number>()

  if (userIds.length === 0) {
    return hoursMap
  }

  try {
    const date = parseLocalDate(weekDate)
    const weekStart = getWeekStart(date)
    const weekEnd = getWeekEnd(date)

    const weekStartStr = formatDateStr(weekStart)
    const weekEndStr = formatDateStr(weekEnd)

    const permanentFirefighters = await sql`
      SELECT tm.user_id
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ANY(${userIds})
        AND t.type = 'permanent'
    `

    const permanentUserIds = new Set(permanentFirefighters.map((row: any) => row.user_id))

    const cycleConfig = await sql`
      SELECT start_date, cycle_length_days
      FROM cycle_config
      WHERE is_active = true
      LIMIT 1
    `

    if (cycleConfig.length === 0) {
      userIds.forEach((id) => hoursMap.set(id, permanentUserIds.has(id) ? 42 : 0))
      return hoursMap
    }

    const { start_date, cycle_length_days } = cycleConfig[0]
    const cycleStartDate = parseLocalDate(start_date)

    // Calculate cycle days for the entire week
    const cycleDays: number[] = []
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart)
      currentDate.setDate(weekStart.getDate() + i)
      cycleDays.push(getCycleDay(currentDate, cycleStartDate, cycle_length_days))
    }

    const [teams, regularShifts, replacementShifts, extraAssignments] = await Promise.all([
      sql`
        SELECT user_id, team_id
        FROM team_members
        WHERE user_id = ANY(${userIds})
      `,
      sql`
        SELECT tm.user_id, s.shift_type, s.cycle_day
        FROM shifts s
        JOIN team_members tm ON s.team_id = tm.team_id
        WHERE tm.user_id = ANY(${userIds})
          AND s.cycle_day = ANY(${cycleDays})
      `,
      sql`
        SELECT ra.applicant_id as user_id, r.shift_type, r.is_partial, r.start_time, r.end_time, r.shift_date
        FROM replacements r
        JOIN replacement_applications ra ON r.id = ra.replacement_id
        WHERE ra.applicant_id = ANY(${userIds})
          AND ra.status = 'approved'
          AND r.status = 'assigned'
          AND r.shift_date >= ${weekStartStr}
          AND r.shift_date <= ${weekEndStr}
      `,
      sql`
        SELECT sa.user_id, sa.is_partial, sa.start_time, sa.end_time, s.shift_type, s.cycle_day
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ANY(${userIds})
          AND sa.is_extra = true
          AND s.cycle_day = ANY(${cycleDays})
      `,
    ])

    userIds.forEach((id) => hoursMap.set(id, permanentUserIds.has(id) ? 42 : 0))

    for (const shift of regularShifts) {
      if (!permanentUserIds.has(shift.user_id)) {
        const currentHours = hoursMap.get(shift.user_id) || 0
        hoursMap.set(shift.user_id, currentHours + calculateShiftHours(shift.shift_type, false, null, null))
      }
    }

    for (const shift of replacementShifts) {
      const currentHours = hoursMap.get(shift.user_id) || 0
      hoursMap.set(
        shift.user_id,
        currentHours + calculateShiftHours(shift.shift_type, shift.is_partial, shift.start_time, shift.end_time),
      )
    }

    for (const assignment of extraAssignments) {
      const currentHours = hoursMap.get(assignment.user_id) || 0
      hoursMap.set(
        assignment.user_id,
        currentHours +
          calculateShiftHours(assignment.shift_type, assignment.is_partial, assignment.start_time, assignment.end_time),
      )
    }

    return hoursMap
  } catch (error) {
    console.error("[v0] getBatchFirefighterWeeklyHours: Error:", error)
    const permanentFirefighters = await sql`
      SELECT tm.user_id
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ANY(${userIds})
        AND t.type = 'permanent'
    `
    const permanentUserIds = new Set(permanentFirefighters.map((row: any) => row.user_id))
    userIds.forEach((id) => hoursMap.set(id, permanentUserIds.has(id) ? 42 : 0))
    return hoursMap
  }
}
