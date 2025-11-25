"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { getShiftNotesForDateRange } from "@/app/actions/shift-notes"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import type { Shift } from "@/types/shift"

// Placeholder for getCycleInfo, as it's used in updates but not defined in existing code
async function getCycleInfo() {
  try {
    const result = await sql`
      SELECT start_date, cycle_length_days as cycle_length FROM cycle_config WHERE is_active = true LIMIT 1
    `
    return result[0] || { start_date: null, cycle_length: 0 }
  } catch (error) {
    console.error("[v0] getCycleInfo: Query failed", error)
    return { start_date: null, cycle_length: 0 }
  }
}

export async function getCycleConfig() {
  try {
    const result = await sql`
      SELECT * FROM cycle_config WHERE is_active = true LIMIT 1
    `
    return result[0] || null
  } catch (error) {
    return null
  }
}

export async function getShiftsForTeam(teamId: number) {
  try {
    const shifts = await sql`
      SELECT * FROM shifts
      WHERE team_id = ${teamId}
      ORDER BY cycle_day
    `
    return shifts
  } catch (error) {
    return []
  }
}

export async function getAllShifts() {
  try {
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
  } catch (error) {
    console.error("[v0] getAllShifts: Query failed, returning empty array", error)
    return []
  }
}

export async function getUserSchedule(userId: number, startDate: string, endDate: string) {
  try {
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
  } catch (error) {
    console.error("[v0] getUserSchedule: Query failed, returning empty array", error)
    return []
  }
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

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] createShift: Query failed", error)
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

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] deleteShift: Query failed", error)
    return { error: "Erreur lors de la suppression du quart" }
  }
}

export async function getAllShiftsWithAssignments(startDate: Date, endDate: Date): Promise<Shift[]> {
  const cycleLength = 28

  const shiftsResult = await sql`
    SELECT 
      s.id,
      s.cycle_day,
      s.shift_type,
      s.start_time,
      s.end_time,
      s.team_id,
      t.name as team_name,
      t.color as team_color,
      COALESCE(
        string_agg(
          u.first_name || '|' || u.last_name || '|' || u.role || '|' || COALESCE(u.id::text, '') || '|' || 
          CASE u.role
            WHEN 'captain' THEN '1'
            WHEN 'lieutenant' THEN '2'
            WHEN 'pp1' THEN '3'
            WHEN 'pp2' THEN '4'
            WHEN 'pp3' THEN '5'
            WHEN 'pp4' THEN '6'
            WHEN 'pp5' THEN '7'
            WHEN 'pp6' THEN '8'
            ELSE '999'
          END || '|false|false|||false|false|false|0',
          ';'
          ORDER BY CASE u.role
            WHEN 'captain' THEN 1
            WHEN 'lieutenant' THEN 2
            WHEN 'pp1' THEN 3
            WHEN 'pp2' THEN 4
            WHEN 'pp3' THEN 5
            WHEN 'pp4' THEN 6
            WHEN 'pp5' THEN 7
            WHEN 'pp6' THEN 8
            ELSE 999
          END
        ) FILTER (WHERE tm.id IS NOT NULL),
        ''
      ) as assigned_firefighters
    FROM shifts s
    JOIN teams t ON s.team_id = t.id
    LEFT JOIN team_members tm ON tm.team_id = s.team_id
    LEFT JOIN users u ON tm.user_id = u.id
    WHERE s.cycle_day BETWEEN 1 AND ${cycleLength}
    GROUP BY s.id, s.cycle_day, s.shift_type, s.start_time, s.team_id, t.name, t.color
    ORDER BY s.cycle_day, s.shift_type;
  `

  const shiftsData = shiftsResult as unknown as Shift[]

  console.log(
    "[v0] getAllShiftsWithAssignments: Returning",
    shiftsData.length,
    "base shifts (without direct assignments)",
  )

  return shiftsData
}

export async function getDirectAssignmentsForRange(startDate: string, endDate: string) {
  try {
    const result = await sql`
      SELECT 
        sa.id,
        sa.shift_id,
        sa.shift_date,
        sa.user_id,
        sa.replaced_user_id,
        sa.replaced_role,
        u.first_name,
        u.last_name,
        u.role,
        s.cycle_day,
        s.shift_type,
        s.team_id
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.is_direct_assignment = true
        AND sa.shift_date >= ${startDate}::date
        AND sa.shift_date <= ${endDate}::date
    `

    return result
  } catch (error: any) {
    console.error("[v0] getDirectAssignmentsForRange: Query failed", error.message)
    return []
  }
}

export async function getActingDesignationsForRange(startDate: string, endDate: string) {
  try {
    // Simply get all acting designations - we'll filter by date in the frontend
    const designations = await sql`
      SELECT 
        sa.shift_id,
        sa.user_id,
        sa.is_acting_lieutenant,
        sa.is_acting_captain,
        s.shift_type,
        s.team_id,
        s.cycle_day,
        u.first_name,
        u.last_name
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN users u ON sa.user_id = u.id
      WHERE (sa.is_acting_lieutenant = true OR sa.is_acting_captain = true)
    `

    return designations.map((row: any) => ({
      user_id: row.user_id,
      shift_id: row.shift_id,
      is_acting_lieutenant: row.is_acting_lieutenant,
      is_acting_captain: row.is_acting_captain,
      shift_type: row.shift_type,
      team_id: row.team_id,
      cycle_day: row.cycle_day,
    }))
  } catch (error: any) {
    console.error("[v0] getActingDesignationsForRange: Query failed", error.message)
    return []
  }
}

export async function getShiftWithAssignments(shiftId: number, shiftDate?: Date) {
  try {
    const shiftDateStr = shiftDate ? shiftDate.toISOString().split("T")[0] : null

    const result = shiftDateStr
      ? sql`
      WITH shift_info AS (
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
      ),
      team_members_data AS (
        SELECT 
          tm.id::integer,
          tm.user_id as original_user_id,
          sa_direct.user_id as direct_assignment_user_id,
          COALESCE(sa_direct.user_id, tm.user_id) as user_id,
          false as is_extra,
          COALESCE(sa_direct.is_partial, false) as is_partial,
          sa_direct.start_time::text as start_time,
          sa_direct.end_time::text as end_time,
          NULL::integer as replacement_id,
          NULL::text as replacement_status,
          u.first_name as original_first_name,
          u.last_name as original_last_name,
          u_direct.first_name as direct_first_name,
          u_direct.last_name as direct_last_name,
          COALESCE(u_direct.first_name, u.first_name) as first_name,
          COALESCE(u_direct.last_name, u.last_name) as last_name,
          u.role,
          COALESCE(u_direct.email, u.email) as email,
          COALESCE(sa.is_acting_lieutenant, sa_direct.is_acting_lieutenant, false) as showsLtBadge,
          COALESCE(sa.is_acting_captain, sa_direct.is_acting_captain, false) as showsCptBadge,
          COALESCE(sa.is_acting_lieutenant, sa_direct.is_acting_lieutenant, false) as is_acting_lieutenant,
          COALESCE(sa.is_acting_captain, sa_direct.is_acting_captain, false) as is_acting_captain,
          COALESCE(sa_direct.is_direct_assignment, false) as is_direct_assignment,
          sa_direct.replaced_user_id::integer,
          CASE 
            WHEN sa_direct.user_id IS NOT NULL THEN u.first_name || ' ' || u.last_name
            ELSE NULL
          END::text as replaced_name,
          sa_direct.replacement_order::integer,
          sa_direct.shift_date::text as direct_assignment_shift_date,
          1 as source_order
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN shift_info si ON tm.team_id = si.team_id
        LEFT JOIN shift_assignments sa ON sa.shift_id = si.id AND sa.user_id = tm.user_id AND sa.is_extra = false AND (sa.is_direct_assignment = false OR sa.is_direct_assignment IS NULL)
        LEFT JOIN shift_assignments sa_direct ON sa_direct.shift_id = si.id 
          AND sa_direct.replaced_user_id = tm.user_id 
          AND sa_direct.is_direct_assignment = true
          AND sa_direct.shift_date::date = ${shiftDateStr}::date
        LEFT JOIN users u_direct ON sa_direct.user_id = u_direct.id
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
      ),
      extra_firefighters_data AS (
        SELECT 
          sa.id::integer,
          NULL::integer as original_user_id,
          NULL::integer as direct_assignment_user_id,
          sa.user_id,
          sa.is_extra,
          COALESCE(sa.is_partial, false) as is_partial,
          sa.start_time::text as start_time,
          sa.end_time::text as end_time,
          NULL::integer as replacement_id,
          NULL::text as replacement_status,
          NULL::text as original_first_name,
          NULL::text as original_last_name,
          NULL::text as direct_first_name,
          NULL::text as direct_last_name,
          u.first_name,
          u.last_name,
          u.role,
          u.email,
          COALESCE(sa.is_acting_lieutenant, false) as showsLtBadge,
          COALESCE(sa.is_acting_captain, false) as showsCptBadge,
          COALESCE(sa.is_acting_lieutenant, false) as is_acting_lieutenant,
          COALESCE(sa.is_acting_captain, false) as is_acting_captain,
          false as is_direct_assignment,
          NULL::integer as replaced_user_id,
          NULL::text as replaced_name,
          NULL::integer as replacement_order,
          NULL::text as direct_assignment_shift_date,
          2 as source_order
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
      ),
      cycle_config_data AS (
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      )
      SELECT 
        json_build_object(
          'id', si.id,
          'team_id', si.team_id,
          'cycle_day', si.cycle_day,
          'shift_type', si.shift_type,
          'start_time', si.start_time,
          'end_time', si.end_time,
          'team_name', si.team_name,
          'team_type', si.team_type,
          'team_color', si.team_color,
          'cycle_start_date', cc.start_date,
          'cycle_length_days', cc.cycle_length_days
        ) as shift_data,
        COALESCE(
          json_agg(
            json_build_object(
              'id', tm.id,
              'original_user_id', tm.original_user_id,
              'direct_assignment_user_id', tm.direct_assignment_user_id,
              'user_id', tm.user_id,
              'is_extra', tm.is_extra,
              'is_partial', tm.is_partial,
              'start_time', tm.start_time,
              'end_time', tm.end_time,
              'replacement_id', tm.replacement_id,
              'replacement_status', tm.replacement_status,
              'original_first_name', tm.original_first_name,
              'original_last_name', tm.original_last_name,
              'direct_first_name', tm.direct_first_name,
              'direct_last_name', tm.direct_last_name,
              'first_name', tm.first_name,
              'last_name', tm.last_name,
              'role', tm.role,
              'email', tm.email,
              'showsLtBadge', tm.showsLtBadge,
              'showsCptBadge', tm.showsCptBadge,
              'is_acting_lieutenant', tm.is_acting_lieutenant,
              'is_acting_captain', tm.is_acting_captain,
              'is_direct_assignment', tm.is_direct_assignment,
              'replaced_user_id', tm.replaced_user_id,
              'replaced_name', tm.replaced_name,
              'replacement_order', tm.replacement_order,
              'direct_assignment_shift_date', tm.direct_assignment_shift_date
            ) ORDER BY tm.source_order, 
              CASE tm.role 
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
              tm.last_name
          ) FILTER (WHERE tm.id IS NOT NULL),
          '[]'::json
        ) as assignments_data
      FROM shift_info si
      CROSS JOIN cycle_config_data cc
      LEFT JOIN (
        SELECT * FROM team_members_data
        UNION ALL
        SELECT * FROM extra_firefighters_data
      ) tm ON true
      GROUP BY si.id, si.team_id, si.cycle_day, si.shift_type, si.start_time, si.end_time, 
               si.team_name, si.team_type, si.team_color, cc.start_date, cc.cycle_length_days
    `
      : sql`
      WITH shift_info AS (
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
      ),
      team_members_data AS (
        SELECT 
          tm.id::integer,
          tm.user_id as original_user_id,
          sa_direct.user_id as direct_assignment_user_id,
          COALESCE(sa_direct.user_id, tm.user_id) as user_id,
          false as is_extra,
          COALESCE(sa_direct.is_partial, false) as is_partial,
          sa_direct.start_time::text as start_time,
          sa_direct.end_time::text as end_time,
          NULL::integer as replacement_id,
          NULL::text as replacement_status,
          u.first_name as original_first_name,
          u.last_name as original_last_name,
          u_direct.first_name as direct_first_name,
          u_direct.last_name as direct_last_name,
          COALESCE(u_direct.first_name, u.first_name) as first_name,
          COALESCE(u_direct.last_name, u.last_name) as last_name,
          u.role,
          COALESCE(u_direct.email, u.email) as email,
          COALESCE(sa.is_acting_lieutenant, sa_direct.is_acting_lieutenant, false) as showsLtBadge,
          COALESCE(sa.is_acting_captain, sa_direct.is_acting_captain, false) as showsCptBadge,
          COALESCE(sa.is_acting_lieutenant, sa_direct.is_acting_lieutenant, false) as is_acting_lieutenant,
          COALESCE(sa.is_acting_captain, sa_direct.is_acting_captain, false) as is_acting_captain,
          COALESCE(sa_direct.is_direct_assignment, false) as is_direct_assignment,
          sa_direct.replaced_user_id::integer,
          CASE 
            WHEN sa_direct.user_id IS NOT NULL THEN u.first_name || ' ' || u.last_name
            ELSE NULL
          END::text as replaced_name,
          sa_direct.replacement_order::integer,
          sa_direct.shift_date::text as direct_assignment_shift_date,
          1 as source_order
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN shift_info si ON tm.team_id = si.team_id
        LEFT JOIN shift_assignments sa ON sa.shift_id = si.id AND sa.user_id = tm.user_id AND sa.is_extra = false AND (sa.is_direct_assignment = false OR sa.is_direct_assignment IS NULL)
        LEFT JOIN shift_assignments sa_direct ON sa_direct.shift_id = si.id 
          AND sa_direct.replaced_user_id = tm.user_id 
          AND sa_direct.is_direct_assignment = true
        LEFT JOIN users u_direct ON sa_direct.user_id = u_direct.id
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
      ),
      extra_firefighters_data AS (
        SELECT 
          sa.id::integer,
          NULL::integer as original_user_id,
          NULL::integer as direct_assignment_user_id,
          sa.user_id,
          sa.is_extra,
          COALESCE(sa.is_partial, false) as is_partial,
          sa.start_time::text as start_time,
          sa.end_time::text as end_time,
          NULL::integer as replacement_id,
          NULL::text as replacement_status,
          NULL::text as original_first_name,
          NULL::text as original_last_name,
          NULL::text as direct_first_name,
          NULL::text as direct_last_name,
          u.first_name,
          u.last_name,
          u.role,
          u.email,
          COALESCE(sa.is_acting_lieutenant, false) as showsLtBadge,
          COALESCE(sa.is_acting_captain, false) as showsCptBadge,
          COALESCE(sa.is_acting_lieutenant, false) as is_acting_lieutenant,
          COALESCE(sa.is_acting_captain, false) as is_acting_captain,
          false as is_direct_assignment,
          NULL::integer as replaced_user_id,
          NULL::text as replaced_name,
          NULL::integer as replacement_order,
          NULL::text as direct_assignment_shift_date,
          2 as source_order
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
      ),
      cycle_config_data AS (
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      )
      SELECT 
        json_build_object(
          'id', si.id,
          'team_id', si.team_id,
          'cycle_day', si.cycle_day,
          'shift_type', si.shift_type,
          'start_time', si.start_time,
          'end_time', si.end_time,
          'team_name', si.team_name,
          'team_type', si.team_type,
          'team_color', si.team_color,
          'cycle_start_date', cc.start_date,
          'cycle_length_days', cc.cycle_length_days
        ) as shift_data,
        COALESCE(
          json_agg(
            json_build_object(
              'id', tm.id,
              'original_user_id', tm.original_user_id,
              'direct_assignment_user_id', tm.direct_assignment_user_id,
              'user_id', tm.user_id,
              'is_extra', tm.is_extra,
              'is_partial', tm.is_partial,
              'start_time', tm.start_time,
              'end_time', tm.end_time,
              'replacement_id', tm.replacement_id,
              'replacement_status', tm.replacement_status,
              'original_first_name', tm.original_first_name,
              'original_last_name', tm.original_last_name,
              'direct_first_name', tm.direct_first_name,
              'direct_last_name', tm.direct_last_name,
              'first_name', tm.first_name,
              'last_name', tm.last_name,
              'role', tm.role,
              'email', tm.email,
              'showsLtBadge', tm.showsLtBadge,
              'showsCptBadge', tm.showsCptBadge,
              'is_acting_lieutenant', tm.is_acting_lieutenant,
              'is_acting_captain', tm.is_acting_captain,
              'is_direct_assignment', tm.is_direct_assignment,
              'replaced_user_id', tm.replaced_user_id,
              'replaced_name', tm.replaced_name,
              'replacement_order', tm.replacement_order,
              'direct_assignment_shift_date', tm.direct_assignment_shift_date
            ) ORDER BY tm.source_order, 
              CASE tm.role 
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
              tm.last_name
          ) FILTER (WHERE tm.id IS NOT NULL),
          '[]'::json
        ) as assignments_data
      FROM shift_info si
      CROSS JOIN cycle_config_data cc
      LEFT JOIN (
        SELECT * FROM team_members_data
        UNION ALL
        SELECT * FROM extra_firefighters_data
      ) tm ON true
      GROUP BY si.id, si.team_id, si.cycle_day, si.shift_type, si.start_time, si.end_time, 
               si.team_name, si.team_type, si.team_color, cc.start_date, cc.cycle_length_days
    `

    const resultData = await result.catch((err: any) => {
      const errorMessage = err?.message || String(err)
      if (errorMessage.includes("Too Many")) {
        console.error("[v0] getShiftWithAssignments: Rate limit exceeded, please wait a moment and try again")
      } else {
        console.error("[v0] getShiftWithAssignments: Combined query failed", errorMessage)
      }
      throw err
    })

    if (!Array.isArray(resultData) || resultData.length === 0) {
      return null
    }

    const { shift_data, assignments_data } = resultData[0]
    const shift = shift_data
    let assignments = assignments_data || []

    if (shift.cycle_start_date && shift.cycle_length_days) {
      const cycleStartDate = new Date(shift.cycle_start_date)
      const cycleLength = shift.cycle_length_days

      assignments = assignments.filter((assignment: any) => {
        if (!assignment.is_direct_assignment) {
          return true
        }

        if (!assignment.direct_assignment_shift_date) {
          return true
        }

        const assignmentDateStr = assignment.direct_assignment_shift_date.substring(0, 10)

        if (shiftDate) {
          const shiftDateStr = shiftDate.toISOString().substring(0, 10)
          const matches = assignmentDateStr === shiftDateStr

          return matches
        }

        return true
      })
    }

    if (!shift || !shift.team_name) {
      console.error("[v0] getShiftWithAssignments: Invalid shift data returned")
      return null
    }

    let extraReplacementRequests: any[] = []
    if (shift.cycle_start_date && shift.cycle_length_days) {
      const startDate = new Date(shift.cycle_start_date)
      const cycleDay = shift.cycle_day
      const shiftType = shift.shift_type
      const teamId = shift.team_id

      const allExtraRequests = await sql`
        SELECT 
          r.id,
          r.user_id,
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
      `.catch((err) => {
        console.error("[v0] getShiftWithAssignments: Extra requests query failed", err?.message || err)
        return []
      })

      if (Array.isArray(allExtraRequests)) {
        extraReplacementRequests = allExtraRequests
          .filter((req: any) => {
            const reqDate = new Date(req.shift_date)
            const daysSinceStart = Math.floor((reqDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            const reqCycleDay = (daysSinceStart % shift.cycle_length_days) + 1

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
    }

    return {
      ...shift,
      assignments: [...assignments, ...extraReplacementRequests],
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many")) {
      console.error("[v0] getShiftWithAssignments: Rate limit exceeded, please wait a moment and try again")
    } else {
      console.error("[v0] getShiftWithAssignments: Query failed", errorMessage)
    }
    return null
  }
}

export async function getReplacementsForDateRange(startDate: string, endDate: string) {
  try {
    const replacements = await sql`
      WITH cycle_info AS (
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      )
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
        r.application_deadline,
        u.first_name as replaced_first_name,
        u.last_name as replaced_last_name,
        u.role as replaced_role,
        repl_user.id as replacement_id,
        repl_user.first_name as replacement_first_name,
        repl_user.last_name as replacement_last_name,
        sa.is_acting_captain as replacement_is_acting_captain,
        sa.is_acting_lieutenant as replacement_is_acting_lieutenant
      FROM replacements r
      JOIN users u ON r.user_id = u.id
      CROSS JOIN cycle_info ci
      LEFT JOIN replacement_applications approved_app ON 
        approved_app.replacement_id = r.id 
        AND approved_app.status = 'approved'
      LEFT JOIN users repl_user ON approved_app.applicant_id = repl_user.id
      LEFT JOIN shifts s ON 
        s.team_id = r.team_id 
        AND s.shift_type = r.shift_type
        AND s.cycle_day = (
          ((r.shift_date::date - ci.start_date::date) % ci.cycle_length_days) + 1
        )
      LEFT JOIN shift_assignments sa ON 
        sa.shift_id = s.id 
        AND sa.user_id = repl_user.id
      WHERE r.shift_date >= ${startDate}
        AND r.shift_date <= ${endDate}
        AND r.status != 'cancelled'
    `

    return replacements
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many")) {
      console.error("[v0] getReplacementsForDateRange: Rate limit exceeded, please wait a moment")
    } else {
      console.error("[v0] getReplacementsForDateRange: Query failed", errorMessage)
    }
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
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many")) {
      console.error("[v0] getLeavesForDateRange: Rate limit exceeded, please wait a moment")
    } else {
      console.error("[v0] getLeavesForDateRange: Query failed", errorMessage)
    }
    return []
  }
}

export async function getExchangesForDateRange(startDate: string, endDate: string) {
  try {
    const exchanges = await sql`
      SELECT 
        se.id,
        se.requester_id,
        se.target_id,
        se.requester_shift_date,
        se.requester_shift_type,
        se.requester_team_id,
        se.target_shift_date,
        se.target_shift_type,
        se.target_team_id,
        se.is_partial,
        se.requester_start_time,
        se.requester_end_time,
        se.target_start_time,
        se.target_end_time,
        req.first_name as requester_first_name,
        req.last_name as requester_last_name,
        req.role as requester_role,
        tgt.first_name as target_first_name,
        tgt.last_name as target_last_name,
        tgt.role as target_role
      FROM shift_exchanges se
      JOIN users req ON se.requester_id = req.id
      JOIN users tgt ON se.target_id = tgt.id
      WHERE se.status = 'approved'
        AND (
          (se.requester_shift_date >= ${startDate} AND se.requester_shift_date <= ${endDate})
          OR (se.target_shift_date >= ${startDate} AND se.target_shift_date <= ${endDate})
        )
    `
    return exchanges
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many")) {
      console.error("[v0] getExchangesForDateRange: Rate limit exceeded, please wait a moment")
    } else {
      console.error("[v0] getExchangesForDateRange: Query failed", errorMessage)
    }
    return []
  }
}

export async function getShiftNotesForDate(shiftId: number, date: string) {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM shift_notes
      WHERE shift_id = ${shiftId} AND shift_date = ${date}
    `
    return result[0]?.count > 0
  } catch (error) {
    console.error("[v0] getShiftNotesForDate: Query failed", error)
    return false
  }
}

export async function getCalendarDataForDateRange(startDate: string, endDate: string) {
  const [replacements, exchanges, leaves, shiftNotes] = await Promise.all([
    getReplacementsForDateRange(startDate, endDate),
    getExchangesForDateRange(startDate, endDate),
    getLeavesForDateRange(startDate, endDate),
    getShiftNotesForDateRange(startDate, endDate),
  ])

  return {
    replacements,
    exchanges,
    leaves,
    shiftNotes,
  }
}

export async function revalidateCalendar() {
  "use server"
  try {
    revalidatePath("/dashboard/calendar")
    invalidateCache()
    return { success: true }
  } catch (error) {
    console.error("Error revalidating calendar cache:", error)
    return { error: "Failed to revalidate cache" }
  }
}

export async function getDirectAssignmentsForDateRange(startDate: Date, endDate: Date) {
  const startDateStr = format(startDate, "yyyy-MM-dd")
  const endDateStr = format(endDate, "yyyy-MM-dd")

  try {
    const result = await sql`
      SELECT 
        sa.id,
        sa.shift_id,
        sa.shift_date,
        sa.user_id as replacement_user_id,
        sa.replaced_user_id,
        sa.replacement_order,
        u.first_name as replacement_first_name,
        u.last_name as replacement_last_name,
        u.role as replacement_role,
        replaced_user.first_name as replaced_first_name,
        replaced_user.last_name as replaced_last_name,
        replaced_user.role as replaced_role,
        s.cycle_day,
        s.shift_type,
        s.team_id
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      JOIN users replaced_user ON sa.replaced_user_id = replaced_user.id
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.is_direct_assignment = true
        AND sa.shift_date >= ${startDateStr}::date
        AND sa.shift_date <= ${endDateStr}::date
      ORDER BY sa.shift_date
    `

    return result
  } catch (error: any) {
    console.error("[v0] Error loading direct assignments:", error)
    return []
  }
}
