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
    const extraReplacementRequestsRaw = await sql`
      SELECT 
        r.id,
        r.shift_date,
        r.shift_type,
        r.team_id,
        r.status,
        r.is_partial,
        r.start_time,
        r.end_time,
        approved_app.applicant_id,
        approved_u.first_name as approved_first_name,
        approved_u.last_name as approved_last_name,
        approved_u.role as approved_role
      FROM replacements r
      LEFT JOIN replacement_applications approved_app ON 
        approved_app.replacement_id = r.id 
        AND approved_app.status = 'approved'
      LEFT JOIN users approved_u ON approved_app.applicant_id = approved_u.id
      WHERE r.user_id IS NULL
        AND r.status = 'open'
    `

    const shifts = await sql`
      WITH team_firefighters AS (
        SELECT 
          tm.team_id,
          string_agg(
            u.first_name || '|' || u.last_name || '|' || u.role || '|false|' || 
            COALESCE(sa_team.is_partial::text, 'false') || '|' ||
            COALESCE(sa_team.start_time::text, '') || '|' ||
            COALESCE(sa_team.end_time::text, ''),
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
          ) as team_members_str,
          COUNT(*) as team_member_count
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        LEFT JOIN shift_assignments sa_team ON sa_team.user_id = u.id AND sa_team.is_extra = false
        GROUP BY tm.team_id
      ),
      extra_firefighters AS (
        SELECT 
          sa.shift_id,
          string_agg(
            u.first_name || '|' || u.last_name || '|' || u.role || '|true|' ||
            COALESCE(sa.is_partial::text, 'false') || '|' ||
            COALESCE(sa.start_time::text, '') || '|' ||
            COALESCE(sa.end_time::text, ''),
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
          ) as extra_members_str
        FROM shift_assignments sa
        JOIN users u ON sa.user_id = u.id
        WHERE sa.is_extra = true
        GROUP BY sa.shift_id
      ),
      cycle_info AS (
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      )
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
        COALESCE(tf.team_member_count, 0) as assigned_count,
        CASE 
          WHEN tf.team_members_str IS NOT NULL AND ef.extra_members_str IS NOT NULL 
            THEN tf.team_members_str || ';' || ef.extra_members_str
          WHEN tf.team_members_str IS NOT NULL 
            THEN tf.team_members_str
          WHEN ef.extra_members_str IS NOT NULL 
            THEN ef.extra_members_str
          ELSE NULL
        END as assigned_firefighters,
        ci.start_date as cycle_start_date,
        ci.cycle_length_days
      FROM shifts s
      JOIN teams t ON s.team_id = t.id
      LEFT JOIN team_firefighters tf ON t.id = tf.team_id
      LEFT JOIN extra_firefighters ef ON s.id = ef.shift_id
      CROSS JOIN cycle_info ci
      ORDER BY s.cycle_day, t.name
    `

    const cycleConfig = await getCycleConfig()
    if (cycleConfig && extraReplacementRequestsRaw.length > 0) {
      const startDate = new Date(cycleConfig.start_date)
      const cycleLength = cycleConfig.cycle_length_days

      for (const shift of shifts) {
        const matchingRequests = extraReplacementRequestsRaw.filter((req: any) => {
          const reqDate = new Date(req.shift_date)
          const daysSinceStart = Math.floor((reqDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const reqCycleDay = (daysSinceStart % cycleLength) + 1

          return reqCycleDay === shift.cycle_day && req.shift_type === shift.shift_type && req.team_id === shift.team_id
        })

        if (matchingRequests.length > 0) {
          const extraRequestsStr = matchingRequests
            .map((req: any) => {
              if (req.status === "assigned" && req.applicant_id) {
                return `${req.approved_first_name}|${req.approved_last_name}|${req.approved_role}|true|${req.is_partial || false}|${req.start_time || ""}|${req.end_time || ""}|${req.id}|${req.status}`
              } else {
                return `Pompier|supplémentaire|firefighter|true|${req.is_partial || false}|${req.start_time || ""}|${req.end_time || ""}|${req.id}|${req.status}`
              }
            })
            .join(";")

          if (shift.assigned_firefighters) {
            shift.assigned_firefighters += ";" + extraRequestsStr
          } else {
            shift.assigned_firefighters = extraRequestsStr
          }
        }
      }
    }

    return shifts
  } catch (error) {
    console.error("[v0] getAllShiftsWithAssignments: Query failed, returning empty array", error)
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
    return replacements
  } catch (error) {
    console.error("[v0] getReplacementsForDateRange: Query failed, returning empty array", error)
    return []
  }
}

export async function getLeavesForDateRange(startDate: string, endDate: string) {
  try {
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
    return leaves
  } catch (error) {
    console.error("[v0] getLeavesForDateRange: Query failed, returning empty array", error)
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

  const teamMembers = await sql`
    SELECT 
      tm.id,
      tm.user_id,
      false as is_extra,
      false as is_partial,
      NULL as start_time,
      NULL as end_time,
      NULL as replacement_id,
      NULL as replacement_status,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ${shift[0].team_id}
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

  const extraFirefighters = await sql`
    SELECT 
      sa.id,
      sa.user_id,
      sa.is_extra,
      COALESCE(sa.is_partial, false) as is_partial,
      sa.start_time,
      sa.end_time,
      NULL as replacement_id,
      NULL as replacement_status,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM shift_assignments sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.shift_id = ${shiftId} AND sa.is_extra = true
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

  const cycleConfig = await sql`
    SELECT start_date, cycle_length_days
    FROM cycle_config
    WHERE is_active = true
    LIMIT 1
  `

  let extraReplacementRequests: any[] = []
  if (cycleConfig.length > 0) {
    const { start_date, cycle_length_days } = cycleConfig[0]
    const startDate = new Date(start_date)
    const cycleDay = shift[0].cycle_day
    const shiftType = shift[0].shift_type
    const teamId = shift[0].team_id

    const allExtraRequests = await sql`
      SELECT 
        r.id,
        r.shift_date,
        r.shift_type,
        r.team_id,
        r.status,
        r.is_partial,
        r.start_time,
        r.end_time
      FROM replacements r
      WHERE r.user_id IS NULL
        AND r.status = 'open'
    `

    extraReplacementRequests = allExtraRequests
      .filter((req: any) => {
        const reqDate = new Date(req.shift_date)
        const daysSinceStart = Math.floor((reqDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const reqCycleDay = (daysSinceStart % cycle_length_days) + 1

        return reqCycleDay === cycleDay && req.shift_type === shiftType && req.team_id === teamId
      })
      .map((req: any) => ({
        id: req.id,
        user_id: null,
        is_extra: true,
        is_partial: req.is_partial || false,
        start_time: req.start_time,
        end_time: req.end_time,
        replacement_id: req.id,
        replacement_status: req.status,
        first_name: "Pompier",
        last_name: "supplémentaire",
        role: "firefighter",
        email: null,
      }))
  }

  const assignments = [...teamMembers, ...extraFirefighters, ...extraReplacementRequests]

  return {
    ...shift[0],
    assignments,
  }
}
