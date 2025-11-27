"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"

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
}) {
  try {
    const { shiftId, replacedUserId, assignedUserId, isPartial, startTime, endTime, replacementOrder, shiftDate } =
      params

    const finalShiftDate = shiftDate || null

    const existing = await sql`
      SELECT id FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${assignedUserId}
    `

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
          shift_date = ${finalShiftDate}
        WHERE id = ${existing[0].id}
      `
    } else {
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
          ${isPartial || false},
          ${startTime || null},
          ${endTime || null},
          ${replacementOrder || 1},
          ${finalShiftDate}
        )
      `
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
    console.log("[v0] addSecondReplacement called with:", params)

    const { shiftId, replacedUserId, assignedUserId, startTime, endTime, shiftDate } = params

    const finalShiftDate = shiftDate || null

    const shiftDateFromShifts = await getShiftDate(shiftId)

    const replacement1Info = await sql`
      SELECT id, user_id, start_time, end_time, is_partial, is_direct_assignment 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `

    console.log("[v0] Replacement 1 info from database:", replacement1Info)

    if (replacement1Info.length === 0) {
      return { success: false, error: "Remplaçant 1 introuvable" }
    }

    const r1UserId = replacement1Info[0].user_id
    const r1IsDirectAssignment = replacement1Info[0].is_direct_assignment
    let adjustedEndTime = replacement1Info[0].end_time
    const originalStartTime = replacement1Info[0].start_time

    console.log("[v0] Replacement 1 original hours:", { startTime: originalStartTime, endTime: adjustedEndTime })

    if (!adjustedEndTime) {
      // First try to get it from the replacement record (table replacements)
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

      console.log("[v0] Replacement info from replacements table:", replacementInfo)

      if (replacementInfo.length > 0 && replacementInfo[0].end_time) {
        adjustedEndTime = replacementInfo[0].end_time
      } else {
        // Last resort: get shift end_time
        const shiftInfo = await sql`
          SELECT end_time FROM shifts WHERE id = ${shiftId}
        `

        console.log("[v0] Shift info:", shiftInfo)

        if (shiftInfo.length === 0) {
          return { success: false, error: "Quart introuvable" }
        }

        adjustedEndTime = shiftInfo[0].end_time
      }
    }

    console.log("[v0] Final adjustedEndTime:", adjustedEndTime)

    // Check if there's already a second replacement
    const existingSecond = await sql`
      SELECT id FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 2
    `

    console.log("[v0] Existing second replacement:", existingSecond)

    if (existingSecond.length > 0) {
      return {
        success: false,
        error: "Un deuxième remplaçant existe déjà pour ce quart",
      }
    }

    const r1Start = originalStartTime || "07:00:00"
    const r1End = adjustedEndTime || "17:00:00"
    const r2Start = startTime
    const r2End = endTime

    console.log("[v0] Analyzing overlap:", {
      r1Start,
      r1End,
      r2Start,
      r2End,
    })

    if (r2Start > r1Start && r2End < r1End) {
      console.log("[v0] ERROR: R2 would be in middle - not supported")
      return {
        success: false,
        error:
          "Le remplaçant 2 doit couvrir soit le début, soit la fin du remplacement, mais pas le milieu. Veuillez ajuster les heures pour que le remplaçant 2 commence au début ou se termine à la fin.",
      }
    }

    // Determine overlap type and adjust accordingly
    if (r2Start >= r1End) {
      // Case 1: No overlap - R2 starts after R1 ends (e.g., R1: 7-11, R2: 11-17)
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
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
      console.log("[v0] No overlap - R1 kept as is:", { r1Start, r1End })
    } else if (r2Start <= r1Start && r2End >= r1End) {
      // Case 2: R2 covers entire R1 period
      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `
      console.log("[v0] R2 covers entire R1 - R1 deleted (no hours)")
    } else if (r2Start <= r1Start && r2End < r1End) {
      // Case 3: R2 covers beginning (e.g., R1: 7-12, R2: 7-9 → R1 becomes 9-12)
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
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
      console.log("[v0] R2 covers beginning - R1 adjusted:", {
        newStart: r2End,
        newEnd: r1End,
      })
    } else if (r2Start > r1Start && r2End >= r1End) {
      // Case 4: R2 covers end (e.g., R1: 7-15, R2: 10:30-15 → R1 becomes 7-10:30)
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
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
      console.log("[v0] R2 covers end - R1 adjusted:", {
        newStart: r1Start,
        newEnd: r2Start,
      })
    } else {
      // Case 5: R2 in middle (e.g., R1: 7-16:30, R2: 8:30-14 → R1 becomes: 7-8:30 AND 14-16:30)
      console.log("[v0] R2 in middle - Splitting R1 into two periods")

      await sql`
        DELETE FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `

      // Insert first period (before R2)
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
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r1Start},
          ${r2Start},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
      console.log("[v0] R1 Period 1 (before R2):", {
        start: r1Start,
        end: r2Start,
      })

      // Insert second period (after R2)
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
          ${r1UserId}, 
          ${replacedUserId},
          false, 
          ${r1IsDirectAssignment},
          true,
          ${r2End},
          ${r1End},
          1,
          ${finalShiftDate || shiftDateFromShifts}
        )
      `
      console.log("[v0] R1 Period 2 (after R2):", {
        start: r2End,
        end: r1End,
      })
    }

    const verifyResult = await sql`
      SELECT id, user_id, start_time, end_time, replacement_order 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `
    console.log("[v0] VERIFICATION - All R1 records after changes:", verifyResult)

    // Insert the second replacement
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

    console.log("[v0] Insert result:", result)

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

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
    // If removing replacement 1, promote replacement 2 to replacement 1
    if (replacementOrder === 1) {
      const secondReplacement = await sql`
        SELECT user_id FROM shift_assignments
        WHERE shift_id = ${shiftId}
          AND replacement_order = 2
      `

      if (secondReplacement.length > 0) {
        // Promote replacement 2 to replacement 1
        await sql`
          UPDATE shift_assignments
          SET replacement_order = 1
          WHERE shift_id = ${shiftId}
            AND replacement_order = 2
        `
      }
    }

    // Delete the specified replacement
    await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
        AND is_direct_assignment = true
    `

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

export async function removeDirectAssignment(shiftId: number, userId: number) {
  try {
    await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${userId}
        AND is_direct_assignment = true
    `

    revalidatePath("/dashboard")
    revalidatePath("/calendar")

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: "Erreur lors du retrait de l'assignation",
    }
  }
}
