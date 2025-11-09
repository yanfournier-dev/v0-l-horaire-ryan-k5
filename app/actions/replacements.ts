"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { calculateAutoDeadline, formatLocalDate } from "@/lib/date-utils"

export async function getUserApplications(userId: number) {
  try {
    const applications = await sql`
      SELECT 
        ra.*,
        r.shift_date,
        r.shift_type,
        r.status as replacement_status,
        r.is_partial,
        r.start_time,
        r.end_time,
        r.team_id,
        r.user_id,
        t.name as team_name,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        replacement_user.first_name as assigned_first_name,
        replacement_user.last_name as assigned_last_name
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      LEFT JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      LEFT JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      WHERE ra.applicant_id = ${userId}
      ORDER BY ra.applied_at DESC
    `

    console.log("[v0] getUserApplications result:", applications.length, "applications")
    if (applications.length > 0) {
      console.log("[v0] First application:", applications[0])
    }

    return applications
  } catch (error) {
    console.error("[v0] getUserApplications: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("[v0] getUserApplications: Rate limiting detected - too many requests")
    }
    return []
  }
}

export async function getRecentReplacements() {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        t.name as team_name,
        t.color as team_color,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        replacement_user.first_name as assigned_first_name,
        replacement_user.last_name as assigned_last_name,
        l.start_date as leave_start_date,
        l.end_date as leave_end_date,
        (SELECT COUNT(*) FROM replacement_applications WHERE replacement_id = r.id) as application_count
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN leaves l ON r.leave_id = l.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      LEFT JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      LEFT JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      WHERE r.status IN ('open', 'assigned')
        AND r.shift_date >= CURRENT_DATE
        AND (l.status = 'approved' OR l.id IS NULL)
      ORDER BY r.shift_date ASC, r.shift_type
      LIMIT 50
    `

    console.log("[v0] getRecentReplacements result:", replacements.length, "replacements")
    if (replacements.length > 0) {
      console.log("[v0] First replacement:", replacements[0])
    }

    return replacements
  } catch (error) {
    console.error("[v0] getRecentReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("[v0] getRecentReplacements: Rate limiting detected - too many requests")
    }
    return []
  }
}

export async function getAllReplacements() {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        t.name as team_name,
        t.color as team_color,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        replacement_user.first_name as assigned_first_name,
        replacement_user.last_name as assigned_last_name,
        l.start_date as leave_start_date,
        l.end_date as leave_end_date,
        (SELECT COUNT(*) FROM replacement_applications WHERE replacement_id = r.id) as application_count
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN leaves l ON r.leave_id = l.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      LEFT JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      LEFT JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      ORDER BY r.shift_date DESC, r.shift_type
    `

    console.log("[v0] getAllReplacements result:", replacements.length, "replacements")
    replacements.forEach((r, index) => {
      console.log(`[v0] Replacement ${index + 1}:`, {
        id: r.id,
        shift_date: r.shift_date,
        shift_type: r.shift_type,
        status: r.status,
        first_name: r.first_name,
        last_name: r.last_name,
        application_deadline: r.application_deadline,
        application_count: r.application_count,
      })
    })

    return replacements
  } catch (error) {
    console.error("[v0] getAllReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("[v0] getAllReplacements: Rate limiting detected - too many requests")
    }
    return []
  }
}

export async function getPendingReplacementRequests() {
  try {
    const requests = await sql`
      SELECT 
        r.*,
        t.name as team_name,
        t.color as team_color,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        replacement_user.first_name as assigned_first_name,
        replacement_user.last_name as assigned_last_name,
        l.start_date as leave_start_date,
        l.end_date as leave_end_date,
        l.status as leave_status
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN leaves l ON r.leave_id = l.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      LEFT JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      LEFT JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      WHERE (r.status = 'pending' OR (r.status = 'open' AND l.status = 'pending'))
        AND r.shift_date >= CURRENT_DATE
      ORDER BY r.shift_date ASC, r.shift_type
    `

    console.log("[v0] getPendingReplacementRequests result:", requests.length, "requests")

    return requests
  } catch (error) {
    console.error("[v0] getPendingReplacementRequests: Error", error)
    return []
  }
}

export async function getUserReplacementRequests(userId: number) {
  try {
    const requests = await sql`
      SELECT 
        r.*,
        t.name as team_name,
        t.color as team_color,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        replacement_user.first_name as assigned_first_name,
        replacement_user.last_name as assigned_last_name,
        l.start_date as leave_start_date,
        l.end_date as leave_end_date
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN leaves l ON r.leave_id = l.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      LEFT JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      LEFT JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      WHERE r.user_id = ${userId}
        AND r.status != 'cancelled'
      ORDER BY r.shift_date DESC, r.shift_type
    `

    console.log("[v0] getUserReplacementRequests result:", requests.length, "requests for user", userId)
    if (requests.length > 0) {
      console.log("[v0] First request:", requests[0])
    }

    return requests
  } catch (error) {
    console.error("[v0] getUserReplacementRequests: Error", error)
    return []
  }
}

export async function createReplacementFromShift(
  userId: number,
  shiftDate: string,
  shiftType: string,
  teamId: number,
  isPartial = false,
  startTime?: string,
  endTime?: string,
  deadlineSeconds?: number,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    console.log("[v0] createReplacementFromShift - deadlineSeconds received:", deadlineSeconds)

    let applicationDeadline = null
    let deadlineDuration = null

    if (deadlineSeconds && deadlineSeconds > 0) {
      const deadlineTimestamp = Date.now() + deadlineSeconds * 1000
      applicationDeadline = new Date(deadlineTimestamp).toISOString()
      deadlineDuration = Math.max(1, Math.floor(deadlineSeconds / 60))
      console.log("[v0] createReplacementFromShift - calculated applicationDeadline:", applicationDeadline)
    } else {
      const autoDeadline = calculateAutoDeadline(shiftDate)
      applicationDeadline = autoDeadline.toISOString()
      deadlineDuration = null
      console.log("[v0] createReplacementFromShift - auto deadline:", applicationDeadline)
    }

    const result = await sql`
      INSERT INTO replacements (
        shift_date, shift_type, team_id, status, is_partial, start_time, end_time, user_id,
        application_deadline, deadline_duration
      )
      VALUES (
        ${shiftDate}, ${shiftType}, ${teamId}, 'open',
        ${isPartial}, ${startTime || null}, ${endTime || null}, ${userId},
        ${applicationDeadline}, ${deadlineDuration}
      )
      RETURNING id
    `

    console.log("[v0] createReplacementFromShift - replacement created with id:", result[0].id)

    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true, id: result[0].id }
  } catch (error) {
    console.error("[v0] createReplacementFromShift: Error", error)
    return { error: "Erreur lors de la création du remplacement" }
  }
}

export async function applyForReplacement(replacementId: number, firefighterId?: number) {
  console.log("[v0] applyForReplacement called with replacementId:", replacementId, "firefighterId:", firefighterId)

  const user = await getSession()
  if (!user) {
    console.log("[v0] applyForReplacement: User not authenticated")
    return { error: "Non authentifié" }
  }

  if (firefighterId && firefighterId !== user.id && !user.is_admin) {
    console.log("[v0] applyForReplacement: User not authorized to apply for another firefighter")
    return { error: "Non autorisé" }
  }

  const applicantId = firefighterId || user.id
  console.log("[v0] applyForReplacement: applicantId:", applicantId)

  try {
    const replacement = await sql`
      SELECT user_id, application_deadline FROM replacements WHERE id = ${replacementId}
    `

    console.log("[v0] applyForReplacement: replacement found:", replacement.length > 0)

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    if (replacement[0].application_deadline && !user.is_admin) {
      const deadline = new Date(replacement[0].application_deadline)
      const now = new Date()
      if (now > deadline) {
        return { error: "Le délai pour postuler est expiré" }
      }
    }

    if (replacement[0].user_id === applicantId) {
      console.log("[v0] applyForReplacement: Cannot apply for own replacement")
      return { error: "Vous ne pouvez pas postuler pour votre propre remplacement" }
    }

    const existingApplication = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${applicantId}
    `

    console.log("[v0] applyForReplacement: existing application found:", existingApplication.length > 0)

    if (existingApplication.length > 0) {
      return { error: "Ce pompier a déjà postulé pour ce remplacement" }
    }

    console.log("[v0] applyForReplacement: Inserting new application")
    await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${applicantId}, 'pending')
    `

    console.log("[v0] applyForReplacement: Application inserted successfully")

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] applyForReplacement: Error", error)
    return { error: "Erreur lors de la candidature" }
  }
}

export async function withdrawApplication(applicationId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    await sql`
      DELETE FROM replacement_applications
      WHERE id = ${applicationId} AND applicant_id = ${user.id}
    `

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] withdrawApplication: Error", error)
    return { error: "Erreur lors du retrait de la candidature" }
  }
}

export async function approveApplication(applicationId: number, replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    console.log("[v0] approveApplication called with:", { applicationId, replacementId })

    const appResult = await sql`
      SELECT 
        ra.applicant_id, 
        r.shift_date, 
        r.shift_type, 
        r.team_id,
        r.is_partial,
        r.start_time,
        r.end_time,
        r.user_id
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.id = ${applicationId}
    `

    if (appResult.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const {
      applicant_id: applicantId,
      shift_date,
      shift_type,
      team_id,
      is_partial,
      start_time,
      end_time,
      user_id: replacedUserId,
    } = appResult[0]

    console.log("[v0] approveApplication - applicant details:", {
      applicantId,
      shift_date,
      shift_type,
      team_id,
      replacedUserId,
    })

    const cycleConfig = await sql`
      SELECT start_date, cycle_length_days
      FROM cycle_config
      WHERE is_active = true
      LIMIT 1
    `

    if (cycleConfig.length === 0) {
      return { error: "Configuration du cycle non trouvée" }
    }

    const { start_date, cycle_length_days } = cycleConfig[0]
    const startDate = new Date(start_date)
    const shiftDateObj = new Date(shift_date)
    const daysDiff = Math.floor((shiftDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const cycleDay = (daysDiff % cycle_length_days) + 1

    console.log("[v0] approveApplication - calculated cycleDay:", cycleDay)

    const shiftResult = await sql`
      SELECT id FROM shifts
      WHERE team_id = ${team_id}
        AND cycle_day = ${cycleDay}
        AND shift_type = ${shift_type}
      LIMIT 1
    `

    if (shiftResult.length === 0) {
      return { error: "Quart non trouvé" }
    }

    const shiftId = shiftResult[0].id
    console.log("[v0] approveApplication - shiftId:", shiftId)

    await sql`
      UPDATE replacement_applications
      SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected'
      WHERE replacement_id = ${replacementId} AND id != ${applicationId}
    `

    await sql`
      UPDATE replacements
      SET status = 'assigned'
      WHERE id = ${replacementId}
    `

    console.log("[v0] approveApplication - Creating notification for applicant:", applicantId)
    await createNotification(
      applicantId,
      "Remplacement assigné",
      `Vous avez été assigné au remplacement du ${formatLocalDate(shift_date)} (${shift_type === "day" ? "Jour" : "Nuit"})`,
      "application_approved",
      replacementId,
      "replacement",
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    console.log("[v0] approveApplication - Success, returning shiftId:", shiftId)
    return { success: true, shiftId }
  } catch (error) {
    console.error("[v0] approveApplication: Error", error)
    return { error: "Erreur lors de l'assignation" }
  }
}

export async function rejectApplication(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const appResult = await sql`
      SELECT applicant_id FROM replacement_applications WHERE id = ${applicationId}
    `

    if (appResult.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const applicantId = appResult[0].applicant_id

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    await createNotification(
      applicantId,
      "Candidature rejetée",
      "Votre candidature pour un remplacement a été rejetée.",
      "application_rejected",
      null,
      null,
    )

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] rejectApplication: Error", error)
    return { error: "Erreur lors du rejet" }
  }
}

export async function deleteReplacement(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacementDetails = await sql`
      SELECT r.*, u.first_name, u.last_name
      FROM replacements r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ${replacementId}
    `

    console.log("[v0] deleteReplacement - Deleting replacement:", {
      id: replacementId,
      details: replacementDetails[0],
    })

    if (replacementDetails.length > 0) {
      const { shift_date, shift_type, team_id } = replacementDetails[0]

      const cycleConfig = await sql`
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      `

      if (cycleConfig.length > 0) {
        const { start_date, cycle_length_days } = cycleConfig[0]
        const startDate = new Date(start_date)
        const shiftDateObj = new Date(shift_date)
        const daysDiff = Math.floor((shiftDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const cycleDay = (daysDiff % cycle_length_days) + 1

        const shiftResult = await sql`
          SELECT id FROM shifts
          WHERE team_id = ${team_id}
            AND cycle_day = ${cycleDay}
            AND shift_type = ${shift_type}
          LIMIT 1
        `

        if (shiftResult.length > 0) {
          const shiftId = shiftResult[0].id
          console.log("[v0] deleteReplacement - Removing all shift_assignments for shiftId:", shiftId)

          // This allows the calendar to reset to default state (showing permanent captain/lieutenant badges)
          await sql`
            DELETE FROM shift_assignments
            WHERE shift_id = ${shiftId}
          `

          console.log("[v0] deleteReplacement - All shift_assignments removed")
        }
      }
    }

    await sql`
      DELETE FROM replacements WHERE id = ${replacementId}
    `

    console.log("[v0] deleteReplacement - Replacement deleted successfully")

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")

    try {
      console.log("[v0] deleteReplacement - Invalidating cache")
      invalidateCache()
      console.log("[v0] deleteReplacement - Cache invalidated successfully")
    } catch (cacheError) {
      console.error("[v0] deleteReplacement - Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] deleteReplacement: Error", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function getReplacementsForShift(shiftDate: string, shiftType: string, teamId: number) {
  try {
    console.log("[v0] getReplacementsForShift called with:", { shiftDate, shiftType, teamId })

    const replacements = await sql`
      SELECT 
        r.*,
        u.first_name,
        u.last_name,
        u.role,
        u.email,
        (
          SELECT json_agg(
            json_build_object(
              'id', ra.id,
              'applicant_id', ra.applicant_id,
              'status', ra.status,
              'applied_at', ra.applied_at,
              'first_name', app_user.first_name,
              'last_name', app_user.last_name
            )
          )
          FROM replacement_applications ra
          JOIN users app_user ON ra.applicant_id = app_user.id
          WHERE ra.replacement_id = r.id
        ) as applications
      FROM replacements r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.shift_date = ${shiftDate}
        AND r.shift_type = ${shiftType}
        AND r.team_id = ${teamId}
        AND r.status != 'cancelled'
      ORDER BY r.created_at DESC
    `

    console.log("[v0] getReplacementsForShift result:", replacements.length, "replacements")
    if (replacements.length > 0) {
      replacements.forEach((r, index) => {
        console.log(`[v0] Replacement ${index + 1}:`, {
          id: r.id,
          user_id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          status: r.status,
          application_deadline: r.application_deadline,
          is_partial: r.is_partial,
        })
      })
    }

    return replacements.map((r) => ({
      ...r,
      applications: r.applications || [],
    }))
  } catch (error) {
    console.error("[v0] getReplacementsForShift: Error", error)
    return []
  }
}

export async function createExtraFirefighterReplacement(
  shiftDate: string,
  shiftType: string,
  teamId: number,
  isPartial = false,
  startTime?: string,
  endTime?: string,
  deadlineSeconds?: number,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    console.log("[v0] createExtraFirefighterReplacement - deadlineSeconds received:", deadlineSeconds)

    let applicationDeadline = null
    let deadlineDuration = null

    if (deadlineSeconds && deadlineSeconds > 0) {
      const deadlineTimestamp = Date.now() + deadlineSeconds * 1000
      applicationDeadline = new Date(deadlineTimestamp).toISOString()
      deadlineDuration = Math.max(1, Math.floor(deadlineSeconds / 60))
    } else {
      const autoDeadline = calculateAutoDeadline(shiftDate)
      applicationDeadline = autoDeadline.toISOString()
      deadlineDuration = null
    }

    const result = await sql`
      INSERT INTO replacements (
        shift_date, shift_type, team_id, status, is_partial, start_time, end_time, is_extra,
        application_deadline, deadline_duration
      )
      VALUES (
        ${shiftDate}, ${shiftType}, ${teamId}, 'open',
        ${isPartial}, ${startTime || null}, ${endTime || null}, true,
        ${applicationDeadline}, ${deadlineDuration}
      )
      RETURNING id
    `

    console.log("[v0] createExtraFirefighterReplacement - replacement created with id:", result[0].id)

    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true, id: result[0].id }
  } catch (error) {
    console.error("[v0] createExtraFirefighterReplacement: Error", error)
    return { error: "Erreur lors de la création de la demande" }
  }
}

export async function updateReplacementAssignment(replacementId: number, assignedTo: number | null) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    if (assignedTo) {
      await sql`
        INSERT INTO replacement_applications (replacement_id, applicant_id, status, reviewed_by, reviewed_at)
        VALUES (${replacementId}, ${assignedTo}, 'approved', ${user.id}, CURRENT_TIMESTAMP)
        ON CONFLICT (replacement_id, applicant_id) 
        DO UPDATE SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      `

      await sql`
        UPDATE replacement_applications
        SET status = 'rejected'
        WHERE replacement_id = ${replacementId} AND applicant_id != ${assignedTo}
      `

      await sql`
        UPDATE replacements
        SET status = 'assigned'
        WHERE id = ${replacementId}
      `
    } else {
      await sql`
        UPDATE replacement_applications
        SET status = 'rejected'
        WHERE replacement_id = ${replacementId} AND status = 'approved'
      `

      await sql`
        UPDATE replacement_applications
        SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
        WHERE replacement_id = ${replacementId} AND status = 'rejected'
      `

      await sql`
        UPDATE replacements
        SET status = 'open'
        WHERE id = ${replacementId}
      `
    }

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] updateReplacementAssignment: Error", error)
    return { error: "Erreur lors de la mise à jour" }
  }
}

export async function getAvailableFirefighters(replacementId: number) {
  try {
    // First, get the shift date from the replacement
    const replacement = await sql`
      SELECT shift_date, shift_type FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      console.error("[v0] getAvailableFirefighters: Replacement not found")
      return []
    }

    const { shift_date: shiftDate } = replacement[0]

    const firefighters = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.role,
        u.email
      FROM users u
      WHERE u.id NOT IN (
        SELECT DISTINCT user_id
        FROM leaves
        WHERE start_date <= ${shiftDate}
          AND end_date >= ${shiftDate}
          AND status = 'approved'
      )
      ORDER BY u.last_name, u.first_name
    `

    return firefighters
  } catch (error) {
    console.error("[v0] getAvailableFirefighters: Error", error)
    return []
  }
}

export async function approveReplacementRequest(replacementId: number, deadlineSeconds?: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacement = await sql`
      SELECT shift_date FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const shiftDate = replacement[0].shift_date

    let applicationDeadline = null
    let deadlineDuration = null

    if (deadlineSeconds && deadlineSeconds > 0) {
      const deadlineTimestamp = Date.now() + deadlineSeconds * 1000
      applicationDeadline = new Date(deadlineTimestamp).toISOString()
      deadlineDuration = Math.max(1, Math.floor(deadlineSeconds / 60))
    } else {
      const autoDeadline = calculateAutoDeadline(shiftDate)
      applicationDeadline = autoDeadline.toISOString()
      deadlineDuration = null
    }

    await sql`
      UPDATE replacements
      SET status = 'open', 
          application_deadline = ${applicationDeadline},
          deadline_duration = ${deadlineDuration}
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] approveReplacementRequest: Error", error)
    return { error: "Erreur lors de l'approbation" }
  }
}

export async function rejectReplacementRequest(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      UPDATE replacements
      SET status = 'cancelled'
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] rejectReplacementRequest: Error", error)
    return { error: "Erreur lors du rejet" }
  }
}

export async function requestReplacement(
  shiftDate: string,
  shiftType: string,
  teamId: number,
  isPartial = false,
  startTime?: string,
  endTime?: string,
) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  if (!shiftDate || !shiftType || !teamId) {
    return { error: "Tous les champs sont requis" }
  }

  try {
    await sql`
      INSERT INTO replacements (
        shift_date, shift_type, team_id, user_id, status, is_partial, start_time, end_time
      )
      VALUES (
        ${shiftDate}, ${shiftType}, ${teamId}, ${user.id}, 'pending',
        ${isPartial}, ${startTime || null}, ${endTime || null}
      )
    `

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] requestReplacement: Error", error)
    return { error: "Erreur lors de la demande de remplacement" }
  }
}

export async function removeReplacementAssignment(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacementDetails = await sql`
      SELECT r.shift_date, r.shift_type, r.team_id, ra.applicant_id
      FROM replacements r
      LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
      WHERE r.id = ${replacementId}
    `

    if (replacementDetails.length > 0) {
      const { shift_date, shift_type, team_id, applicant_id } = replacementDetails[0]

      const cycleConfig = await sql`
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      `

      if (cycleConfig.length > 0) {
        const { start_date, cycle_length_days } = cycleConfig[0]
        const startDate = new Date(start_date)
        const shiftDateObj = new Date(shift_date)
        const daysDiff = Math.floor((shiftDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const cycleDay = (daysDiff % cycle_length_days) + 1

        const shiftResult = await sql`
          SELECT id FROM shifts
          WHERE team_id = ${team_id}
            AND cycle_day = ${cycleDay}
            AND shift_type = ${shift_type}
          LIMIT 1
        `

        if (shiftResult.length > 0) {
          const shiftId = shiftResult[0].id
          console.log("[v0] removeReplacementAssignment - Removing all shift_assignments for shiftId:", shiftId)

          await sql`
            DELETE FROM shift_assignments
            WHERE shift_id = ${shiftId}
          `

          console.log("[v0] removeReplacementAssignment - All shift_assignments removed")
        }
      }

      if (applicant_id) {
        await createNotification(
          applicant_id,
          "Assignation retirée",
          `Votre assignation au remplacement du ${formatLocalDate(shift_date)} (${shift_type === "day" ? "Jour" : "Nuit"}) a été retirée.`,
          "assignment_removed",
          replacementId,
          "replacement",
        )
      }
    }

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected'
      WHERE replacement_id = ${replacementId} AND status = 'approved'
    `

    await sql`
      UPDATE replacement_applications
      SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
      WHERE replacement_id = ${replacementId} AND status = 'rejected'
    `

    await sql`
      UPDATE replacements
      SET status = 'open'
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] removeReplacementAssignment: Error", error)
    return { error: "Erreur lors du retrait de l'assignation" }
  }
}

export async function getExpiredReplacements() {
  try {
    const allOpenReplacements = await sql`
      SELECT 
        r.id,
        r.shift_date,
        r.shift_type,
        r.status,
        r.application_deadline,
        replaced_user.first_name,
        replaced_user.last_name,
        (SELECT COUNT(*) FROM replacement_applications WHERE replacement_id = r.id) as application_count
      FROM replacements r
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      WHERE r.status = 'open'
        AND r.shift_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY r.shift_date ASC
    `

    console.log("[v0] getExpiredReplacements - All open replacements:", allOpenReplacements.length)
    allOpenReplacements.forEach((r, index) => {
      console.log(`[v0] Open replacement ${index + 1}:`, {
        id: r.id,
        shift_date: r.shift_date,
        first_name: r.first_name,
        last_name: r.last_name,
        application_deadline: r.application_deadline,
        deadline_passed: r.application_deadline ? new Date(r.application_deadline) < new Date() : false,
        application_count: r.application_count,
      })
    })

    const replacements = await sql`
      SELECT 
        r.*,
        t.name as team_name,
        t.color as team_color,
        replaced_user.first_name as first_name,
        replaced_user.last_name as last_name,
        (SELECT COUNT(*) FROM replacement_applications WHERE replacement_id = r.id) as application_count
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      WHERE r.status = 'open'
        AND r.application_deadline IS NOT NULL
        AND r.application_deadline < CURRENT_TIMESTAMP
        AND r.shift_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY r.application_deadline ASC
    `

    console.log("[v0] getExpiredReplacements result:", replacements.length, "replacements")
    if (replacements.length > 0) {
      console.log("[v0] First expired replacement:", replacements[0])
    }

    return replacements
  } catch (error) {
    console.error("[v0] getExpiredReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("[v0] getExpiredReplacements: Rate limiting detected - too many requests")
    }
    return []
  }
}

export async function reactivateApplication(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Check if the replacement is not assigned
    const appResult = await sql`
      SELECT r.status, ra.status as application_status
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.id = ${applicationId}
    `

    if (appResult.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    if (appResult[0].status === "assigned") {
      return { error: "Impossible de réactiver une candidature pour un remplacement déjà assigné" }
    }

    if (appResult[0].application_status !== "rejected") {
      return { error: "Seules les candidatures rejetées peuvent être réactivées" }
    }

    await sql`
      UPDATE replacement_applications
      SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
      WHERE id = ${applicationId}
    `

    revalidatePath("/dashboard/replacements")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] reactivateApplication: Error", error)
    return { error: "Erreur lors de la réactivation" }
  }
}
