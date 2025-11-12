"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"

const sql = neon(process.env.DATABASE_URL!)

export async function createDirectAssignment(params: {
  shiftId: number
  replacedUserId: number
  assignedUserId: number
  dateRange: { start: Date; end?: Date }
  isPartial?: boolean
  startTime?: string
  endTime?: string
}) {
  try {
    const { shiftId, replacedUserId, assignedUserId, dateRange, isPartial, startTime, endTime } = params

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
          end_time = ${endTime || null}
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
          end_time
        )
        VALUES (
          ${shiftId}, 
          ${assignedUserId}, 
          ${replacedUserId},
          false, 
          true,
          ${isPartial || false},
          ${startTime || null},
          ${endTime || null}
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
