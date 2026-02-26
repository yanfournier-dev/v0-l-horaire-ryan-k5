"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "./audit"
import { getSession } from "./auth"
import { checkConsecutiveHours } from "@/lib/consecutive-hours"

const sql = neon(process.env.DATABASE_URL!, {
  fetchConnectionCache: true,
  disableWarningInBrowsers: true,
})

async function getShiftDate(shiftId: number): Promise<string | null> {
  const result = await sql`
    SELECT 
      TO_CHAR(
        (SELECT start_date FROM cycle_config WHERE is_active = true LIMIT 1) + 
        (s.cycle_day - 1) * INTERVAL '1 day',
        'YYYY-MM-DD'
      ) as shift_date
    FROM shifts s
    WHERE s.id = ${shiftId}
  `
  return result.length > 0 ? result[0].shift_date : null
}

export async function createDirectAssignment(params: {
  shiftId: number
  replacedUserId: number
  assignedUserId: number
  isPartial?: boolean
  startTime?: string
  endTime?: string
  replacementOrder?: number
  shiftDate?: string
  override?: boolean
}) {
  try {
    const user = await getSession()
    if (!user) {
      return { success: false, error: "Non autorisé" }
    }

    const {
      shiftId,
      replacedUserId,
      assignedUserId,
      isPartial,
      startTime,
      endTime,
      replacementOrder,
      shiftDate,
      override,
    } = params

    const finalShiftDate = shiftDate || null

    const shiftInfo = await sql`
      SELECT shift_type FROM shifts WHERE id = ${shiftId}
    `

    if (shiftInfo.length === 0) {
      return { success: false, error: "Quart non trouvé" }
    }

    if (finalShiftDate && !override) {
      const consecutiveCheck = await checkConsecutiveHours(
        assignedUserId,
        finalShiftDate,
        shiftInfo[0].shift_type,
        isPartial || false,
        startTime,
        endTime,
      )

      if (consecutiveCheck.exceeds) {
        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: consecutiveCheck.message,
          totalHours: consecutiveCheck.totalHours,
        }
      }
    }

    const existing = await sql`
      SELECT id FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${assignedUserId}
    `

    const users = await sql`
      SELECT id, first_name, last_name FROM users
      WHERE id IN (${assignedUserId}, ${replacedUserId})
    `
    const assignedUser = users.find((u: any) => u.id === assignedUserId)
    const replacedUser = users.find((u: any) => u.id === replacedUserId)

    if (existing.length > 0) {
      await sql`
        UPDATE shift_assignments
        SET 
          is_direct_assignment = true,
          replaced_user_id = ${replacedUserId},
          is_partial = ${isPartial || false},
          start_time = ${startTime || null},
          end_time = ${endTime || null},
          replacement_order = ${replacementOrder || 1},
          shift_date = ${finalShiftDate},
          updated_by = ${user.id},
          updated_at_audit = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
      `

      await createAuditLog({
        userId: user.id,
        actionType: "ASSIGNMENT_CREATED",
        tableName: "shift_assignments",
        recordId: existing[0].id,
        description: `Assignation directe mise à jour: ${assignedUser?.first_name} ${assignedUser?.last_name} remplace ${replacedUser?.first_name} ${replacedUser?.last_name}${isPartial && startTime && endTime ? ` (${startTime.slice(0, 5)}-${endTime.slice(0, 5)})` : ""}`,
      })
    } else {
      const result = await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          replacement_order,
          shift_date,
          created_by,
          created_at_audit
        )
        VALUES (
          ${shiftId}, 
          ${assignedUserId}, 
          ${replacedUserId},
          false, 
          true,
          ${isPartial || false},
          ${startTime || null},
          ${endTime || null},
          ${replacementOrder || 1},
          ${finalShiftDate},
          ${user.id},
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `

      await createAuditLog({
        userId: user.id,
        actionType: "ASSIGNMENT_CREATED",
        tableName: "shift_assignments",
        recordId: result[0].id,
        description: `Assignation directe créée: ${assignedUser?.first_name} ${assignedUser?.last_name} remplace ${replacedUser?.first_name} ${replacedUser?.last_name}${isPartial && startTime && endTime ? ` (${startTime.slice(0, 5)}-${endTime.slice(0, 5)})` : ""}`,
      })
    }

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error:
        errorMessage.includes("replaced_user_id") || errorMessage.includes("is_direct_assignment")
          ? "La base de données doit être mise à jour. Cliquez sur 'Run Scripts' dans la bannière orange."
          : "Erreur lors de la création de l'assignation directe",
    }
  }
}

export async function addSecondReplacement(params: {
  shiftId: number
  replacedUserId: number
  assignedUserId: number
  startTime: string
  endTime: string
  shiftDate?: string
}) {
  try {
    const user = await getSession()
    if (!user) {
      return { success: false, error: "Non autorisé" }
    }

    const { shiftId, replacedUserId, assignedUserId, startTime, endTime, shiftDate } = params

    const finalShiftDate = shiftDate || null

    const shiftDateFromShifts = await getShiftDate(shiftId)

    const existingAssignment = await sql`
      SELECT id, user_id, replaced_user_id, replacement_order 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${assignedUserId}
        AND shift_date = ${finalShiftDate || shiftDateFromShifts}
    `

    if (existingAssignment.length > 0) {
      const existing = existingAssignment[0]
      return {
        success: false,
        error: `Ce pompier est déjà assigné sur ce quart (ordre de remplacement: ${existing.replacement_order || "N/A"})`,
      }
    }

    const replacement1Info = await sql`
      SELECT id, user_id, start_time, end_time, original_end_time, is_partial, is_direct_assignment 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `

    if (replacement1Info.length === 0) {
      const existingSecond = await sql`
        SELECT id FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 2
      `

      if (existingSecond.length > 0) {
        return {
          success: false,
          error: "Un deuxième remplaçant existe déjà pour ce quart",
        }
      }

      const result = await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${assignedUserId}, 
          ${replacedUserId},
          false, 
          true,
          true,
          ${startTime},
          ${endTime},
          2,
          ${finalShiftDate || shiftDateFromShifts}
        )
        RETURNING *
      `

      revalidatePath("/dashboard")
      revalidatePath("/calendar")

      return { success: true }
    }

    const r1UserId = replacement1Info[0].user_id
    const r1IsDirectAssignment = replacement1Info[0].is_direct_assignment
    let adjustedEndTime = replacement1Info[0].original_end_time || replacement1Info[0].end_time
    const originalStartTime = replacement1Info[0].start_time

    if (!adjustedEndTime) {
      const replacementInfo = await sql`
        SELECT end_time, is_partial
        FROM replacements
        WHERE shift_date || '-' || shift_type || '-' || team_id IN (
          SELECT CONCAT(
            TO_CHAR((
              SELECT start_date + (s.cycle_day - 1) * INTERVAL '1 day'
              FROM cycle_config
              WHERE is_active = true
              LIMIT 1
            ), 'YYYY-MM-DD'), '-', s.shift_type, '-', s.team_id
          )
          FROM shifts s
          WHERE s.id = ${shiftId}
        )
        AND user_id = ${replacedUserId}
        AND status != 'cancelled'
        LIMIT 1
      `

      if (replacementInfo.length > 0 && replacementInfo[0].end_time) {
        adjustedEndTime = replacementInfo[0].end_time
      } else {
        const shiftInfo = await sql`
          SELECT end_time FROM shifts WHERE id = ${shiftId}
        `

        if (shiftInfo.length === 0) {
          return { success: false, error: "Quart introuvable" }
        }

        adjustedEndTime = shiftInfo[0].end_time
      }
    }

    const existingSecond = await sql`
      SELECT id FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 2
    `

    if (existingSecond.length > 0) {
      return {
        success: false,
        error: "Un deuxième remplaçant existe déjà pour ce quart",
      }
    }

    const normalizeTime = (time: string): string => {
      if (!time) return time
      return time.length === 5 ? `${time}:00` : time
    }

    // Get the shift details to get the correct start/end times
    const shiftDetails = await sql`
      SELECT shift_type, start_time, end_time FROM shifts WHERE id = ${shiftId}
    `

    if (shiftDetails.length === 0) {
      return { success: false, error: "Quart introuvable" }
    }

    const shiftStartTime = shiftDetails[0].start_time
    const shiftEndTime = shiftDetails[0].end_time

    // Safety check: if r1 times are NULL or invalid, get them from the shift
    const r1Start = normalizeTime(originalStartTime || shiftStartTime || "07:00:00")
    const r1End = normalizeTime(adjustedEndTime || shiftEndTime || "17:00:00")
    const r2Start = normalizeTime(params.startTime)
    const r2End = normalizeTime(params.endTime)

    // Helper function: check if time is within a range that may cross midnight
    const timeIsWithinRange = (time: string, rangeStart: string, rangeEnd: string): boolean => {
      if (rangeStart < rangeEnd) {
        // Normal range (day shift): 07:00 to 17:00
        return time >= rangeStart && time <= rangeEnd
      } else {
        // Range crosses midnight (night shift): 17:00 to 07:00
        return time >= rangeStart || time <= rangeEnd
      }
    }

    // Helper function: compare two times within a shift context that may cross midnight
    // Returns true if time1 < time2 within the shift context
    const isTimeBeforeInShift = (time1: string, time2: string, shiftStart: string, shiftEnd: string, is24h?: boolean): boolean => {
      if (time1 === time2) return false

      // Treat 24h shifts like night shifts (crosses midnight)
      const treatAsNightShift = shiftStart > shiftEnd || is24h

      if (shiftStart < shiftEnd) {
        // Day shift: simple comparison
        return time1 < time2
      } else if (treatAsNightShift) {
        // Night shift or 24h shift (crosses midnight)
        // Order: shiftStart(17:00) < ... < 23:59 < 00:00 < ... < shiftEnd(07:00)
        if (time1 >= shiftStart && time2 >= shiftStart) {
          // Both after shift start (evening)
          return time1 < time2
        } else if (time1 < shiftEnd && time2 < shiftEnd) {
          // Both before shift end (morning after midnight)
          return time1 < time2
        } else if (time1 >= shiftStart && time2 < shiftEnd) {
          // time1 is in evening, time2 is in morning
          return true
        } else {
          // time1 is in morning, time2 is in evening
          return false
        }
      } else {
        // Fallback: simple comparison
        return time1 < time2
      }
    }

    // Check if R2 is completely in the middle of R1 (invalid configuration)
    const r2IsInMiddle = 
      isTimeBeforeInShift(r1Start, r2Start, shiftStartTime, shiftEndTime) &&
      isTimeBeforeInShift(r2End, r1End, shiftStartTime, shiftEndTime)

    if (r2IsInMiddle) {
      return {
        success: false,
        error:
          "Le remplaçant 2 doit couvrir soit le début, soit la fin du remplacement, mais pas le milieu. Veuillez ajuster les heures pour que le remplaçant 2 commence au début ou se termine à la fin.",
      }
    }

    // Special handling for 24h shifts (shiftStart === shiftEnd)
    const is24hShift = shiftStartTime === shiftEndTime
    
    if (is24hShift) {
      // Case 2 for 24h: R2 covers the beginning
      // R2Start == shiftStart (07:00) AND R2End > R2Start (same-day, not full shift)
      const r2CoversBeginning24h = r2Start === shiftStartTime && r2End > r2Start

      if (r2CoversBeginning24h) {
        await sql`
          DELETE FROM shift_assignments
          WHERE shift_id = ${shiftId}
            AND replaced_user_id = ${replacedUserId}
            AND replacement_order = 1
        `
        await sql`
          INSERT INTO shift_assignments (
            shift_id, 
            user_id, 
            replaced_user_id,
            is_extra, 
            is_direct_assignment,
            is_partial,
            start_time,
            end_time,
            replacement_order,
            shift_date,
            original_start_time,
            original_end_time
          )
          VALUES (
            ${shiftId}, 
            ${r1UserId}, 
            ${replacedUserId},
            false, 
            ${r1IsDirectAssignment},
            true,
            ${r2End},
            ${shiftEndTime},
            1,
            ${finalShiftDate || shiftDateFromShifts},
            ${r1Start},
            ${r1End}
          )
        `
        
        await sql`
          INSERT INTO shift_assignments (
            shift_id, 
            user_id, 
            replaced_user_id,
            is_extra, 
            is_direct_assignment,
            is_partial,
            start_time,
            end_time,
            replacement_order,
            shift_date
          )
          VALUES (
            ${shiftId}, 
            ${assignedUserId}, 
            ${replacedUserId},
            false, 
            true,
            true,
            ${r2Start},
            ${r2End},
            2,
            ${finalShiftDate || shiftDateFromShifts}
          )
        `

        revalidatePath("/dashboard")
        revalidatePath("/calendar")

        return { success: true }
      }

      // Case 3 for 24h: R2 covers the end
      // (R2Start < shiftStart AND R2End == shiftEnd) OR (R2Start > shiftStart AND R2Start >= R2End)
      // This covers: times after midnight going to 07:00, or crossing midnight from daytime
      const r2CoversEnd24h = 
        (r2Start < shiftStartTime && r2End === shiftEndTime) ||
        (r2Start > shiftStartTime && r2Start >= r2End)

      if (r2CoversEnd24h) {
        await sql`
          DELETE FROM shift_assignments
          WHERE shift_id = ${shiftId}
            AND replaced_user_id = ${replacedUserId}
            AND replacement_order = 1
        `
        await sql`
          INSERT INTO shift_assignments (
            shift_id, 
            user_id, 
            replaced_user_id,
            is_extra, 
            is_direct_assignment,
            is_partial,
            start_time,
            end_time,
            replacement_order,
            shift_date,
            original_start_time,
            original_end_time
          )
          VALUES (
            ${shiftId}, 
            ${r1UserId}, 
            ${replacedUserId},
            false, 
            ${r1IsDirectAssignment},
            true,
            ${shiftStartTime},
            ${r2Start},
            1,
            ${finalShiftDate || shiftDateFromShifts},
            ${r1Start},
            ${r1End}
          )
        `

        await sql`
          INSERT INTO shift_assignments (
            shift_id, 
            user_id, 
            replaced_user_id,
            is_extra, 
            is_direct_assignment,
            is_partial,
            start_time,
            end_time,
            replacement_order,
            shift_date
          )
          VALUES (
            ${shiftId}, 
            ${assignedUserId}, 
            ${replacedUserId},
            false, 
            true,
            true,
            ${r2Start},
            ${r2End},
            2,
            ${finalShiftDate || shiftDateFromShifts}
          )
        `

        revalidatePath("/dashboard")
        revalidatePath("/calendar")

        return { success: true }
      }
    }

    // Case: R2 starts after R1 ends (or far past R1 end)
    if (isTimeBeforeInShift(r1End, r2Start, shiftStartTime, shiftEndTime)) {
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `

      await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          original_start_time,
          original_end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r2End},
          ${r1End},
          ${r1Start},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
    } 
    // Case: R2 covers entire R1 (r2Start <= r1Start AND r2End >= r1End)
    else if (timeIsWithinRange(r1Start, r2Start, r2End) && timeIsWithinRange(r1End, r2Start, r2End)) {
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `
    } 
    // Case: R2 covers the beginning (r2Start <= r1Start AND r2End < r1End)
    else if (timeIsWithinRange(r1Start, r2Start, r2End) && !timeIsWithinRange(r1End, r2Start, r2End)) {
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `
      await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          original_start_time,
          original_end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r2End},
          ${r1End},
          ${r1Start},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
    } 
    // Case: R2 covers the end (r2Start > r1Start AND r2End >= r1End)
    else if (timeIsWithinRange(r2Start, r1Start, r1End) && timeIsWithinRange(r1End, r2Start, r2End)) {
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `
      await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          original_start_time,
          original_end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r1Start},
          ${r2Start},
          ${r1Start},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
    } 
    // Case: R2 is completely outside R1 range (shouldn't happen based on earlier logic)
    else {
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `

      await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          original_start_time,
          original_end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r1Start},
          ${r2Start},
          ${r1Start},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `

      await sql`
        INSERT INTO shift_assignments (
          shift_id, 
          user_id, 
          replaced_user_id,
          is_extra, 
          is_direct_assignment,
          is_partial,
          start_time,
          end_time,
          original_start_time,
          original_end_time,
          replacement_order,
          shift_date
        )
        VALUES (
          ${shiftId}, 
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r2End},
          ${r1End},
          ${r1Start},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
    }

    const verifyResult = await sql`
      SELECT id, user_id, start_time, end_time, replacement_order 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `

    const result = await sql`
      INSERT INTO shift_assignments (
        shift_id, 
        user_id, 
        replaced_user_id,
        is_extra, 
        is_direct_assignment,
        is_partial,
        start_time,
        end_time,
        replacement_order,
        shift_date
      )
      VALUES (
        ${shiftId}, 
        ${assignedUserId}, 
        ${replacedUserId},
        false, 
        true,
        true,
        ${startTime},
        ${endTime},
        2,
        ${finalShiftDate || shiftDateFromShifts}
      )
      RETURNING *
    `

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    await createAuditLog({
      userId: user.id,
      actionType: "SECOND_REPLACEMENT_ADDED",
      tableName: "shift_assignments",
      recordId: result[0].id,
      description: `Remplaçant 2 ajouté: ${assignedUserId} remplace ${replacedUserId} (${startTime.slice(0, 5)}-${endTime.slice(0, 5)})`,
    })

    return { success: true }
  } catch (error) {
    console.error("[v0] addSecondReplacement error:", error)
    return {
      success: false,
      error:
        "Erreur lors de l'ajout du deuxième remplaçant: " + (error instanceof Error ? error.message : String(error)),
    }
  }
}

export async function updateReplacementHours(params: {
  shiftId: number
  userId: number
  startTime: string
  endTime: string
}) {
  try {
    const { shiftId, userId, startTime, endTime } = params

    await sql`
      UPDATE shift_assignments
      SET 
        start_time = ${startTime},
        end_time = ${endTime},
        is_partial = true
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
    `

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    return { success: true }
  } catch (error) {
    console.error("updateReplacementHours error:", error)
    return {
      success: false,
      error: "Erreur lors de la mise à jour des heures",
    }
  }
}

export async function removeReplacement(shiftId: number, userId: number, replacementOrder: number) {
  try {
    console.log("[v0] removeReplacement (direct-assignments) CALLED with:", {
      shiftId,
      userId,
      replacementOrder,
    })

    const shiftInfo = await sql`
      SELECT shift_type, start_time, end_time FROM shifts WHERE id = ${shiftId}
    `

    if (shiftInfo.length === 0) {
      console.log("[v0] removeReplacement: Shift not found for shiftId:", shiftId)
      return { success: false, error: "Quart non trouvé" }
    }

    const shift = shiftInfo[0]

    const allReplacements = await sql`
      SELECT id, user_id, replacement_order, is_partial, start_time, end_time, replaced_user_id
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND is_direct_assignment = true
        AND replaced_user_id IS NOT NULL
      ORDER BY replacement_order ASC
    `

    console.log("[v0] removeReplacement: Found direct assignments with replacements:", {
      count: allReplacements.length,
      assignments: allReplacements.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        replacement_order: r.replacement_order,
      })),
    })

    const isDoubleReplacement = allReplacements.length === 2
    const replacementToKeep = allReplacements.find((r: any) => r.user_id !== userId)

    if (isDoubleReplacement && replacementToKeep) {
      console.log("[v0] removeReplacement: Double replacement detected, keeping:", replacementToKeep.id)
      
      // Restore the kept replacement to its original shift hours
      const coversFullShift = shift.start_time === replacementToKeep.start_time && shift.end_time === replacementToKeep.end_time
      
      console.log("[v0] removeReplacement: Restoring to original hours:", {
        original_start: shift.start_time,
        original_end: shift.end_time,
        coversFullShift,
      })

      await sql`
        UPDATE shift_assignments
        SET 
          replacement_order = 1,
          start_time = ${shift.start_time},
          end_time = ${shift.end_time},
          is_partial = ${false}
        WHERE id = ${replacementToKeep.id}
      `
    } else if (replacementOrder === 1 && allReplacements.length === 2) {
      console.log("[v0] removeReplacement: Renumbering replacement_order after first removal")
      const secondReplacement = await sql`
        SELECT user_id FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replacement_order = 2
      `

      if (secondReplacement.length > 0) {
        await sql`
          UPDATE shift_assignments
          SET replacement_order = 1
          WHERE shift_id = ${shiftId}
            AND replacement_order = 2
        `
      }
    }

    console.log("[v0] removeReplacement: DELETING assignment for userId:", userId, "from shiftId:", shiftId)
    const deleteResult = await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
        AND is_direct_assignment = true
    `
    console.log("[v0] removeReplacement: DELETE completed")

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    return { success: true }
  } catch (error) {
    console.error("removeReplacement error:", error)
    return {
      success: false,
      error: "Erreur lors du retrait du remplaçant",
    }
  }
}

export async function removeDirectAssignment(shiftId: number, userId: number, replacementOrder?: number) {
  try {
    const user = await getSession()
    if (!user) {
      return { success: false, error: "Non autorisé" }
    }

    const shiftInfo = await sql`
      SELECT shift_type, start_time, end_time FROM shifts WHERE id = ${shiftId}
    `

    if (shiftInfo.length === 0) {
      return { success: false, error: "Quart non trouvé" }
    }

    const shift = shiftInfo[0]

    // First, get the replaced_user_id of the assignment being removed
    const removingAssignment = await sql`
      SELECT replaced_user_id FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
        AND is_direct_assignment = true
      LIMIT 1
    `

    const replacedUserId = removingAssignment.length > 0 ? removingAssignment[0].replaced_user_id : null

    // Find all replacements for the SAME replaced user, not just any replacement on this shift
    const allReplacements = await sql`
      SELECT id, user_id, replacement_order, is_partial, start_time, end_time, replaced_user_id, is_direct_assignment, original_start_time, original_end_time
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND (replaced_user_id IS NOT NULL OR is_direct_assignment = true)
      ORDER BY replacement_order ASC
    `

    const isDoubleReplacement = allReplacements.length === 2
    const replacementToKeep = allReplacements.find((r: any) => r.user_id !== userId)

    if (isDoubleReplacement && replacementToKeep) {
      // Restore the kept replacement to its original shift hours
      // For 24h shifts that were previously split, use the stored original times
      // For other shifts (day/night), use the shift's start and end times
      const restoreStartTime = replacementToKeep.original_start_time ?? shift.start_time
      const restoreEndTime = replacementToKeep.original_end_time ?? shift.end_time

      await sql`
        UPDATE shift_assignments
        SET 
          replacement_order = 1,
          start_time = ${restoreStartTime},
          end_time = ${restoreEndTime},
          is_partial = ${replacementToKeep.is_partial}
        WHERE id = ${replacementToKeep.id}
      `
    } else if (replacementOrder === 1 && allReplacements.length === 2) {
      const secondReplacement = await sql`
        SELECT user_id FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replacement_order = 2
          AND replaced_user_id = ${replacedUserId}
      `

      if (secondReplacement.length > 0) {
        await sql`
          UPDATE shift_assignments
          SET replacement_order = 1
          WHERE shift_id = ${shiftId}
            AND replacement_order = 2
            AND replaced_user_id = ${replacedUserId}
        `
      }
    }

    const assignmentDetails = await sql`
      SELECT sa.*, u.first_name, u.last_name, replaced.first_name as replaced_first_name, replaced.last_name as replaced_last_name
      FROM shift_assignments sa
      LEFT JOIN users u ON sa.user_id = u.id
      LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
      WHERE sa.shift_id = ${shiftId}
        AND sa.user_id = ${userId}
        AND sa.is_direct_assignment = true
    `

    await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
        AND is_direct_assignment = true
    `

    if (assignmentDetails.length > 0) {
      const assignment = assignmentDetails[0]
      await createAuditLog({
        userId: user.id,
        actionType: "ASSIGNMENT_DELETED",
        tableName: "shift_assignments",
        recordId: assignment.id,
        description: `Assignation directe supprimée: ${assignment.first_name} ${assignment.last_name}${assignment.replaced_first_name ? ` remplaçait ${assignment.replaced_first_name} ${assignment.replaced_last_name}` : ""}`,
      })
    }

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    return { success: true }
  } catch (error) {
    console.error("[v0] removeDirectAssignment error:", error)
    return {
      success: false,
      error: "Erreur lors du retrait de l'assignation",
    }
  }
}
