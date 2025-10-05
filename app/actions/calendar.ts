"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function getCycleConfig() {
  const result = await sql`
    SELECT * FROM cycle_config WHERE is_active = true LIMIT 1
  `
  return result[0] || null
}

export async function getShiftsForTeam(teamId: number) {
  const shifts = await sql`
    SELECT * FROM shifts
    WHERE team_id = ${teamId}
    ORDER BY cycle_day
  `
  return shifts
}

export async function getAllShifts() {
  const shifts = await sql`
    SELECT 
      s.*,
      t.name as team_name,
      t.type as team_type
    FROM shifts s
    JOIN teams t ON s.team_id = t.id
    ORDER BY s.cycle_day, t.name
  `
  return shifts
}

export async function getUserSchedule(userId: number, startDate: string, endDate: string) {
  // Get user's teams
  const teams = await sql`
    SELECT team_id FROM team_members WHERE user_id = ${userId}
  `

  if (teams.length === 0) {
    return []
  }

  const teamIds = teams.map((t: any) => t.team_id)

  // Get shifts for user's teams
  const shifts = await sql`
    SELECT 
      s.*,
      t.name as team_name,
      t.type as team_type
    FROM shifts s
    JOIN teams t ON s.team_id = t.id
    WHERE s.team_id = ANY(${teamIds})
    ORDER BY s.cycle_day
  `

  return shifts
}

export async function createShift(
  teamId: number,
  cycleDay: number,
  shiftType: string,
  startTime: string,
  endTime: string,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      INSERT INTO shifts (team_id, cycle_day, shift_type, start_time, end_time)
      VALUES (${teamId}, ${cycleDay}, ${shiftType}, ${startTime}, ${endTime})
      ON CONFLICT (team_id, cycle_day) 
      DO UPDATE SET 
        shift_type = ${shiftType},
        start_time = ${startTime},
        end_time = ${endTime}
    `
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la création du quart" }
  }
}

export async function deleteShift(shiftId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      DELETE FROM shifts WHERE id = ${shiftId}
    `
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression du quart" }
  }
}

export async function getAllShiftsWithAssignments() {
  try {
    const shifts = await sql`
      SELECT 
        s.id,
        s.team_id,
        s.cycle_day,
        s.shift_type,
        s.start_time,
        s.end_time,
        t.name as team_name,
        t.type as team_type,
        t.color as team_color,
        COUNT(DISTINCT tm.user_id) as assigned_count,
        string_agg(
          u.first_name || '|' || u.last_name || '|' || u.role,
          ';' 
          ORDER BY 
            CASE u.role 
              WHEN 'captain' THEN 1 
              WHEN 'lieutenant' THEN 2 
              WHEN 'pp1' THEN 3 
              WHEN 'pp2' THEN 4 
              WHEN 'pp3' THEN 5 
              WHEN 'pp4' THEN 6 
              WHEN 'pp5' THEN 7 
              WHEN 'pp6' THEN 8 
              ELSE 9 
            END,
            u.last_name,
            u.first_name
        ) as assigned_firefighters
      FROM shifts s
      JOIN teams t ON s.team_id = t.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN users u ON tm.user_id = u.id
      GROUP BY s.id, s.team_id, s.cycle_day, s.shift_type, s.start_time, s.end_time, t.name, t.type, t.color
      ORDER BY s.cycle_day, t.name
    `
    return shifts
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("Too Many R") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error("[v0] getAllShiftsWithAssignments: Rate limit hit, returning empty array")
      return []
    }

    console.error("[v0] getAllShiftsWithAssignments: Query failed", error)
    // Return empty array instead of throwing to prevent page crash
    return []
  }
}

export async function getReplacementsForDateRange(startDate: string, endDate: string) {
  try {
    const replacements = await sql`
      SELECT 
        r.id,
        r.user_id,
        r.shift_date,
        r.shift_type,
        r.team_id,
        r.status,
        r.is_partial,
        r.start_time,
        r.end_time,
        u.first_name as replaced_first_name,
        u.last_name as replaced_last_name,
        u.role as replaced_role,
        repl_user.id as replacement_id,
        repl_user.first_name as replacement_first_name,
        repl_user.last_name as replacement_last_name
      FROM replacements r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN replacement_applications ra ON ra.replacement_id = r.id AND ra.status = 'approved'
      LEFT JOIN users repl_user ON ra.applicant_id = repl_user.id
      WHERE r.shift_date >= ${startDate}
        AND r.shift_date <= ${endDate}
    `

    console.log("[v0] getReplacementsForDateRange returned:", replacements.length, "replacements")
    console.log("[v0] Replacement details:", JSON.stringify(replacements, null, 2))

    return replacements
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check if it's a rate limiting error
    if (
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("Too Many R") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error("[v0] getReplacementsForDateRange: Rate limit hit, returning empty array")
      return []
    }

    console.error("[v0] getReplacementsForDateRange: Query failed", error)
    // Return empty array instead of throwing to prevent page crash
    return []
  }
}

export async function getLeavesForDateRange(startDate: string, endDate: string) {
  try {
    console.log("[v0] getLeavesForDateRange called with:", { startDate, endDate })

    const leaves = await sql`
      SELECT 
        l.id,
        l.user_id,
        l.start_date,
        l.end_date,
        l.leave_type,
        l.start_time,
        l.end_time,
        u.first_name,
        u.last_name
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'approved'
        AND l.start_date <= ${endDate}
        AND l.end_date >= ${startDate}
    `

    console.log("[v0] getLeavesForDateRange returned:", leaves.length, "leaves")
    console.log("[v0] Leaves details:", JSON.stringify(leaves, null, 2))

    return leaves
  } catch (error) {
    console.error("[v0] getLeavesForDateRange ERROR:", error)
    console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")

    const errorMessage = error instanceof Error ? error.message : String(error)

    if (
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("Too Many R") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error("[v0] getLeavesForDateRange: Rate limit hit, returning empty array")
      return []
    }

    console.error("[v0] getLeavesForDateRange: Query failed, returning empty array")
    return []
  }
}

export async function getShiftWithAssignments(shiftId: number) {
  const shift = await sql`
    SELECT 
      s.id,
      s.team_id,
      s.cycle_day,
      s.shift_type,
      s.start_time,
      s.end_time,
      t.name as team_name,
      t.type as team_type,
      t.color as team_color
    FROM shifts s
    JOIN teams t ON s.team_id = t.id
    WHERE s.id = ${shiftId}
  `

  if (shift.length === 0) return null

  const assignments = await sql`
    SELECT 
      sa.id,
      sa.user_id,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM shift_assignments sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.shift_id = ${shiftId}
    ORDER BY 
      CASE u.role 
        WHEN 'captain' THEN 1 
        WHEN 'lieutenant' THEN 2 
        WHEN 'pp1' THEN 3 
        WHEN 'pp2' THEN 4 
        WHEN 'pp3' THEN 5 
        WHEN 'pp4' THEN 6 
        WHEN 'pp5' THEN 7 
        WHEN 'pp6' THEN 8 
        ELSE 9 
      END,
      u.last_name
  `

  return {
    ...shift[0],
    assignments,
  }
}
