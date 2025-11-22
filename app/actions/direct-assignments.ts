"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"

const sql = neon(process.env.DATABASE_URL!)

export async function createDirectAssignment(params: {
  shiftId: number
  replacedUserId: number
  assignedUserId: number
  isPartial?: boolean
  startTime?: string
  endTime?: string
  replacementOrder?: number
}) {
  try {
    const { shiftId, replacedUserId, assignedUserId, isPartial, startTime, endTime, replacementOrder } = params

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
          replacement_order = ${replacementOrder || 1}
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
          replacement_order
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
          ${replacementOrder || 1}
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
}) {
  try {
    console.log("[v0] addSecondReplacement called with:", params)

    const { shiftId, replacedUserId, assignedUserId, startTime, endTime } = params

    const replacement1Info = await sql`
      SELECT start_time, end_time, is_partial 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `

    console.log("[v0] Replacement 1 info from database:", replacement1Info)

    if (replacement1Info.length === 0) {
      return { success: false, error: "Remplaçant 1 introuvable" }
    }

    let adjustedEndTime = replacement1Info[0].end_time

    console.log("[v0] Initial adjustedEndTime:", adjustedEndTime)

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

    await sql`
      UPDATE shift_assignments
      SET 
        start_time = ${endTime},
        end_time = ${adjustedEndTime},
        is_partial = true,
        is_direct_assignment = true
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `

    console.log("[v0] Updated replacement 1 hours:", { startTime: endTime, endTime: adjustedEndTime })

    const verifyUpdate = await sql`
      SELECT start_time, end_time, is_partial 
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND replaced_user_id = ${replacedUserId}
        AND replacement_order = 1
    `
    console.log("[v0] VERIFICATION - Replacement 1 after UPDATE:", verifyUpdate)

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
        replacement_order
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
        2
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
