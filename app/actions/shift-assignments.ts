"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"

export async function getShiftAssignments(shiftId: number) {
  const assignments = await sql`
    SELECT 
      sa.id,
      sa.shift_id,
      sa.user_id,
      sa.assigned_at,
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
        WHEN 'firefighter' THEN 9 
        ELSE 10
      END,
      u.last_name
  `
  return assignments
}

export async function assignFirefighterToShift(shiftId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Check if shift already has 8 firefighters
    const count = await sql`
      SELECT COUNT(*) as count FROM shift_assignments WHERE shift_id = ${shiftId} AND is_extra = false
    `

    if (count[0].count >= 8) {
      return { error: "Ce quart a déjà 8 pompiers assignés" }
    }

    await sql`
      INSERT INTO shift_assignments (shift_id, user_id, is_extra)
      VALUES (${shiftId}, ${userId}, false)
      ON CONFLICT (shift_id, user_id) DO NOTHING
    `

    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'assignation" }
  }
}

export async function addExtraFirefighterToShift(
  shiftId: number,
  userId: number,
  isPartial = false,
  startTime?: string,
  endTime?: string,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Check if this firefighter is already assigned (regular or extra)
    const existing = await sql`
      SELECT COUNT(*) as count FROM shift_assignments 
      WHERE shift_id = ${shiftId} AND user_id = ${userId}
    `

    if (existing[0].count > 0) {
      return { error: "Ce pompier est déjà assigné à ce quart" }
    }

    await sql`
      INSERT INTO shift_assignments (shift_id, user_id, is_extra, is_partial, start_time, end_time)
      VALUES (
        ${shiftId}, 
        ${userId}, 
        true, 
        ${isPartial},
        ${isPartial && startTime ? startTime : null},
        ${isPartial && endTime ? endTime : null}
      )
    `

    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error adding extra firefighter:", error)
    return { error: "Erreur lors de l'ajout du pompier supplémentaire" }
  }
}

export async function removeFirefighterFromShift(shiftId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId} AND user_id = ${userId}
    `

    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}

export async function getTeamFirefighters(teamId: number) {
  const firefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ${teamId}
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
        WHEN 'firefighter' THEN 9 
        ELSE 10
      END,
      u.last_name
  `
  return firefighters
}

export async function getAllFirefighters() {
  const firefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM users u
    WHERE u.is_admin = false
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
        WHEN 'firefighter' THEN 9 
        ELSE 10
      END,
      u.last_name
  `
  return firefighters
}

export async function getUserAssignedShifts(userId: number, targetDate: string) {
  try {
    console.log("[v0] getUserAssignedShifts called with:", { userId, targetDate })

    const allShiftsWithMembers = await sql`
      SELECT 
        s.id,
        s.team_id,
        s.cycle_day,
        s.shift_type,
        s.start_time,
        s.end_time,
        t.name as team_name,
        t.color as team_color,
        tm.user_id
      FROM shifts s
      JOIN teams t ON s.team_id = t.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      ORDER BY s.cycle_day, s.shift_type
    `

    console.log("[v0] Total shift-member combinations:", allShiftsWithMembers.length)

    const cycleConfig = await sql`
      SELECT * FROM cycle_config WHERE is_active = true LIMIT 1
    `

    if (cycleConfig.length === 0) {
      console.log("[v0] No active cycle config found")
      return []
    }

    const { start_date, cycle_length_days } = cycleConfig[0]

    // Parse dates as YYYY-MM-DD strings to avoid timezone conversion
    const startDateStr = new Date(start_date).toISOString().split("T")[0]
    const targetDateStr = new Date(targetDate).toISOString().split("T")[0]

    // Calculate days difference using date strings
    const startParts = startDateStr.split("-").map(Number)
    const targetParts = targetDateStr.split("-").map(Number)

    const startDateObj = new Date(startParts[0], startParts[1] - 1, startParts[2])
    const targetDateObj = new Date(targetParts[0], targetParts[1] - 1, targetParts[2])

    const daysDiff = Math.floor((targetDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
    const cycleDay = (daysDiff % cycle_length_days) + 1

    console.log("[v0] Calculated cycle day:", {
      startDateStr,
      targetDateStr,
      daysDiff,
      cycleDay,
      cycle_length_days,
    })

    const allShiftsForCycleDay = allShiftsWithMembers.filter((shift) => shift.cycle_day === cycleDay)
    const uniqueShiftsForCycleDay = allShiftsForCycleDay.reduce((acc, shift) => {
      if (!acc.find((s) => s.id === shift.id)) {
        acc.push({
          id: shift.id,
          shift_type: shift.shift_type,
          team_name: shift.team_name,
          cycle_day: shift.cycle_day,
        })
      }
      return acc
    }, [] as any[])
    console.log(
      "[v0] ALL shifts available for cycle day",
      cycleDay,
      ":",
      JSON.stringify(uniqueShiftsForCycleDay, null, 2),
    )

    const userTeams = await sql`
      SELECT t.id, t.name
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ${userId}
    `
    console.log("[v0] User is member of teams:", JSON.stringify(userTeams, null, 2))

    const userShifts = allShiftsWithMembers
      .filter((shift) => shift.cycle_day === cycleDay && shift.user_id === userId)
      .reduce((acc, shift) => {
        // Deduplicate by shift id
        if (!acc.find((s) => s.id === shift.id)) {
          acc.push({
            id: shift.id,
            shift_type: shift.shift_type,
            cycle_day: shift.cycle_day,
            team_id: shift.team_id,
            start_time: shift.start_time,
            end_time: shift.end_time,
            team_name: shift.team_name,
            team_color: shift.team_color,
            assignment_type: "team",
          })
        }
        return acc
      }, [] as any[])

    console.log("[v0] User shifts via team membership:", userShifts.length)
    console.log("[v0] User shifts details:", JSON.stringify(userShifts, null, 2))

    const replacementShifts = await sql`
      SELECT DISTINCT
        r.id,
        r.shift_type,
        r.team_id,
        COALESCE(r.start_time, s.start_time) as start_time,
        COALESCE(r.end_time, s.end_time) as end_time,
        t.name as team_name,
        t.color as team_color,
        r.is_partial
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      JOIN teams t ON r.team_id = t.id
      LEFT JOIN shifts s ON s.team_id = r.team_id 
        AND s.shift_type = r.shift_type 
        AND s.cycle_day = ${cycleDay}
      WHERE ra.applicant_id = ${userId}
        AND ra.status = 'approved'
        AND r.shift_date = ${targetDate}
    `

    const formattedReplacementShifts = replacementShifts.map((shift) => ({
      ...shift,
      assignment_type: "replacement",
    }))

    console.log("[v0] Replacement shifts:", formattedReplacementShifts.length)

    // Combine both types of shifts
    const allShifts = [...userShifts, ...formattedReplacementShifts]

    console.log("[v0] getUserAssignedShifts returned:", allShifts.length, "shifts")

    return allShifts
  } catch (error) {
    console.error("[v0] Error fetching user assigned shifts:", error)
    return []
  }
}

export async function isUserAssignedToShift(userId: number, shiftId: number, targetDate: string) {
  try {
    // Get cycle config
    const cycleConfig = await sql`
      SELECT * FROM cycle_config WHERE is_active = true LIMIT 1
    `

    if (cycleConfig.length === 0) {
      return false
    }

    const { start_date, cycle_length_days } = cycleConfig[0]

    const startDateStr = new Date(start_date).toISOString().split("T")[0]
    const targetDateStr = new Date(targetDate).toISOString().split("T")[0]

    const startParts = startDateStr.split("-").map(Number)
    const targetParts = targetDateStr.split("-").map(Number)

    const startDateObj = new Date(startParts[0], startParts[1] - 1, startParts[2])
    const targetDateObj = new Date(targetParts[0], targetParts[1] - 1, targetParts[2])

    const daysDiff = Math.floor((targetDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
    const cycleDay = (daysDiff % cycle_length_days) + 1

    // Check if user is assigned to this shift and it matches the cycle day
    const result = await sql`
      SELECT COUNT(*) as count
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.user_id = ${userId}
        AND sa.shift_id = ${shiftId}
        AND s.cycle_day = ${cycleDay}
    `

    return result[0].count > 0
  } catch (error) {
    console.error("Error checking user shift assignment:", error)
    return false
  }
}
