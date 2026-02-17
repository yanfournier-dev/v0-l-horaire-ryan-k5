"use server"

import { sql } from "@/lib/db"
import { getSession } from "./auth"
import { revalidatePath } from "next/cache"

export async function unassignReplacement(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { success: false, error: "Non autorisé" }
  }

  try {
    const applicationResult = await sql`
      SELECT ra.*, r.id as replacement_id, r.shift_id
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.id = ${applicationId}
        AND ra.status = 'approved'
    `

    if (applicationResult.length === 0) {
      return { success: false, error: "Candidature non trouvée ou déjà annulée" }
    }

    const application = applicationResult[0]
    const shiftId = application.shift_id

    await sql`
      UPDATE replacement_applications
      SET status = 'pending',
          reviewed_at = NULL,
          reviewed_by = NULL
      WHERE id = ${applicationId}
    `

    await sql`
      UPDATE replacements
      SET status = 'open'
      WHERE id = ${application.replacement_id}
    `

    await sql`
      UPDATE replacements
      SET notification_sent = false,
          notification_sent_at = NULL,
          notification_sent_by = NULL,
          notification_types_sent = '[]'::jsonb
      WHERE id = ${application.replacement_id}
    `

    // Restore R1 (replacement_order = 1) to is_partial = false when removing R2
    // First, we need to get the replaced_user_id from R2 to find R1
    const r2Result = await sql`
      SELECT replaced_user_id 
      FROM shift_assignments 
      WHERE shift_id = ${shiftId} 
        AND replacement_order = 2
      LIMIT 1
    `

    if (r2Result.length > 0) {
      const replacedUserId = r2Result[0].replaced_user_id
      console.log("[v0] unassignReplacement - found R2 with replaced_user_id:", replacedUserId)
      
      // Now update R1 with the same replaced_user_id
      await sql`
        UPDATE shift_assignments
        SET is_partial = false
        WHERE shift_id = ${shiftId}
          AND replaced_user_id = ${replacedUserId}
          AND replacement_order = 1
      `
      console.log("[v0] unassignReplacement - updated R1 to is_partial = false")
    }

    revalidatePath("/dashboard/replacements")
    revalidatePath(`/dashboard/replacements/${application.replacement_id}`)

    return { success: true }
  } catch (error) {
    console.error("Error unassigning replacement:", error)
    return { success: false, error: "Erreur lors de l'annulation de l'assignation" }
  }
}
