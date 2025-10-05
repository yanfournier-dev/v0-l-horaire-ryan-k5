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
      COUNT(sa.id) as assigned_count
    FROM shifts s
    JOIN teams t ON s.team_id = t.id
    LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
    GROUP BY s.id, s.team_id, s.cycle_day, s.shift_type, s.start_time, s.end_time, t.name, t.type, t.color
    ORDER BY s.cycle_day, t.name
  `

  return shifts
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
        WHEN 'firefighter' THEN 3 
      END,
      u.last_name
  `

  return {
    ...shift[0],
    assignments,
  }
}
