"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { createNotification, sendBatchReplacementEmails, createBatchNotificationsInApp } from "./notifications"
import { calculateAutoDeadline, formatLocalDate } from "@/lib/date-utils"
import { revalidatePath } from "next/cache"

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

    return applications
  } catch (error) {
    console.error("getUserApplications: Error", error instanceof Error ? error.message : String(error))
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

    return replacements
  } catch (error) {
    console.error("getRecentReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("getRecentReplacements: Rate limiting detected - too many requests")
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

    return replacements
  } catch (error) {
    console.error("getAllReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("getAllReplacements: Rate limiting detected - too many requests")
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

    return requests
  } catch (error) {
    console.error("getPendingReplacementRequests: Error", error)
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

    return requests
  } catch (error) {
    console.error("getUserReplacementRequests: Error", error)
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
  deadlineSeconds?: number | string | Date,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    let applicationDeadline = null
    let deadlineDuration = null

    if (deadlineSeconds) {
      let deadlineValue: string
      
      if (typeof deadlineSeconds === 'object' && deadlineSeconds !== null && deadlineSeconds.toISOString) {
        deadlineValue = deadlineSeconds.toISOString()
      } else if (typeof deadlineSeconds === 'string') {
        deadlineValue = deadlineSeconds
      } else {
        deadlineValue = String(deadlineSeconds)
      }
      
      const isISOString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(deadlineValue)
      
      if (isISOString) {
        applicationDeadline = deadlineValue
        deadlineDuration = null
      } else if (!isNaN(Number(deadlineValue)) && Number(deadlineValue) > 0) {
        const deadlineTimestamp = Date.now() + Number(deadlineValue) * 1000
        applicationDeadline = new Date(deadlineTimestamp).toISOString()
        deadlineDuration = Math.max(1, Math.floor(Number(deadlineValue) / 60))
      } else {
        const autoDeadline = calculateAutoDeadline(shiftDate)
        applicationDeadline = autoDeadline.toISOString()
        deadlineDuration = null
      }
    } else {
      const autoDeadline = calculateAutoDeadline(shiftDate)
      applicationDeadline = autoDeadline.toISOString()
      deadlineDuration = null
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

    const replacementId = result[0].id

    const firefighterInfo = await sql`
      SELECT first_name, last_name FROM users WHERE id = ${userId}
    `
    const firefighterToReplaceName =
      firefighterInfo.length > 0 ? `${firefighterInfo[0].first_name} ${firefighterInfo[0].last_name}` : "Pompier"

    const eligibleUsers = await sql`
      SELECT DISTINCT u.id
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id != ${userId}
        AND (np.notify_replacement_available IS NULL OR np.notify_replacement_available = true)
        AND u.id NOT IN (
          SELECT user_id
          FROM leaves
          WHERE start_date <= ${shiftDate}
            AND end_date >= ${shiftDate}
            AND status = 'approved'
        )
    `

    // Create in-app notifications for all eligible users
    if (eligibleUsers.length > 0) {
      const userIds = eligibleUsers.map((u) => u.id)
      createBatchNotificationsInApp(
        userIds,
        "Nouveau remplacement disponible",
        `Remplacement pour ${firefighterToReplaceName} le ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})`,
        "replacement_available",
        replacementId,
        "replacement",
      ).catch((error) => {
        console.error("Background notification creation failed:", error)
      })
    }

    if (process.env.VERCEL_ENV === "production") {
      sendBatchReplacementEmails(replacementId, firefighterToReplaceName).catch((error) => {
        console.error("PRODUCTION: Batch email sending failed:", error)
      })
    }

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true, id: replacementId }
  } catch (error) {
    console.error("createReplacementFromShift: Error", error)
    return { error: "Erreur lors de la création du remplacement" }
  }
}

export async function applyForReplacement(replacementId: number, firefighterId?: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  if (firefighterId && firefighterId !== user.id && !user.is_admin) {
    return { error: "Non autorisé" }
  }

  const applicantId = firefighterId || user.id

  try {
    const replacement = await sql`
      SELECT user_id, application_deadline FROM replacements WHERE id = ${replacementId}
    `

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
      return { error: "Vous ne pouvez pas postuler pour votre propre remplacement" }
    }

    const existingApplication = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${applicantId}
    `

    if (existingApplication.length > 0) {
      return { error: "Ce pompier a déjà postulé pour ce remplacement" }
    }

    const insertResult = await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${applicantId}, 'pending')
      RETURNING applied_at
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("applyForReplacement: Error", error)
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("withdrawApplication: Error", error)
    return { error: "Erreur lors du retrait de la candidature" }
  }
}

export async function approveApplication(applicationId: number, replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
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
        ${applicantId}, 
        ${replacedUserId},
        false, 
        false,
        ${is_partial || false},
        ${start_time || null},
        ${end_time || null},
        1
      )
      ON CONFLICT (shift_id, user_id) DO UPDATE
      SET 
        replaced_user_id = ${replacedUserId},
        is_partial = ${is_partial || false},
        start_time = ${start_time || null},
        end_time = ${end_time || null},
        replacement_order = 1
    `

    await createNotification(
      applicantId,
      "Remplacement assigné",
      `Vous avez été assigné au remplacement du ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})`,
      "application_approved",
      replacementId,
      "replacement",
    )

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true, shiftId }
  } catch (error) {
    console.error("approveApplication: Error", error)
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("rejectApplication: Error", error)
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

          await sql`
            DELETE FROM shift_assignments
            WHERE shift_id = ${shiftId}
          `
        }
      }
    }

    await sql`
      DELETE FROM replacements WHERE id = ${replacementId}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("deleteReplacement - Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("deleteReplacement: Error", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function getReplacementsForShift(shiftDate: string, shiftType: string, teamId: number) {
  try {
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

    return replacements.map((r) => ({
      ...r,
      applications: r.applications || [],
    }))
  } catch (error) {
    console.error("getReplacementsForShift: Error", error)
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
  deadlineSeconds?: number | string | Date,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    let applicationDeadline = null
    let deadlineDuration = null

    if (deadlineSeconds) {
      let deadlineValue: string
      
      if (typeof deadlineSeconds === 'object' && deadlineSeconds !== null && deadlineSeconds.toISOString) {
        deadlineValue = deadlineSeconds.toISOString()
      } else if (typeof deadlineSeconds === 'string') {
        deadlineValue = deadlineSeconds
      } else {
        deadlineValue = String(deadlineSeconds)
      }
      
      const isISOString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(deadlineValue)
      
      if (isISOString) {
        applicationDeadline = deadlineValue
        deadlineDuration = null
      } else if (!isNaN(Number(deadlineValue)) && Number(deadlineValue) > 0) {
        const deadlineTimestamp = Date.now() + Number(deadlineValue) * 1000
        applicationDeadline = new Date(deadlineTimestamp).toISOString()
        deadlineDuration = Math.max(1, Math.floor(Number(deadlineValue) / 60))
      } else {
        const autoDeadline = calculateAutoDeadline(shiftDate)
        applicationDeadline = autoDeadline.toISOString()
        deadlineDuration = null
      }
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

    const replacementId = result[0].id

    const firefighterToReplaceName = "Pompier supplémentaire"

    const eligibleUsers = await sql`
      SELECT DISTINCT u.id
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE (np.notify_replacement_available IS NULL OR np.notify_replacement_available = true)
        AND u.id NOT IN (
          SELECT user_id
          FROM leaves
          WHERE start_date <= ${shiftDate}
            AND end_date >= ${shiftDate}
            AND status = 'approved'
        )
    `

    // Create in-app notifications for all eligible users
    if (eligibleUsers.length > 0) {
      const userIds = eligibleUsers.map((u) => u.id)
      createBatchNotificationsInApp(
        userIds,
        "Nouveau remplacement disponible",
        `Remplacement (pompier supplémentaire) le ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})`,
        "replacement_available",
        replacementId,
        "replacement",
      ).catch((error) => {
        console.error("Background notification creation failed:", error)
      })
    }

    if (process.env.VERCEL_ENV === "production") {
      sendBatchReplacementEmails(replacementId, firefighterToReplaceName).catch((error) => {
        console.error("PRODUCTION: Batch email sending failed:", error)
      })
    }

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true, id: replacementId }
  } catch (error) {
    console.error("createExtraFirefighterReplacement: Error", error)
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("updateReplacementAssignment: Error", error)
    return { error: "Erreur lors de la mise à jour" }
  }
}

export async function getAvailableFirefighters(replacementId: number) {
  try {
    const replacement = await sql`
      SELECT shift_date, shift_type FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      console.error("getAvailableFirefighters: Replacement not found")
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
    console.error("getAvailableFirefighters: Error", error)
    return []
  }
}

export async function approveReplacementRequest(replacementId: number, deadlineSeconds?: number | string | Date) {
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

    if (deadlineSeconds) {
      let deadlineValue: string
      
      if (typeof deadlineSeconds === 'object' && deadlineSeconds !== null && deadlineSeconds.toISOString) {
        deadlineValue = deadlineSeconds.toISOString()
      } else if (typeof deadlineSeconds === 'string') {
        deadlineValue = deadlineSeconds
      } else {
        deadlineValue = String(deadlineSeconds)
      }
      
      const isISOString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(deadlineValue)
      
      if (isISOString) {
        applicationDeadline = deadlineValue
        deadlineDuration = null
      } else if (!isNaN(Number(deadlineValue)) && Number(deadlineValue) > 0) {
        const deadlineTimestamp = Date.now() + Number(deadlineValue) * 1000
        applicationDeadline = new Date(deadlineTimestamp).toISOString()
        deadlineDuration = Math.max(1, Math.floor(Number(deadlineValue) / 60))
      } else {
        const autoDeadline = calculateAutoDeadline(shiftDate)
        applicationDeadline = autoDeadline.toISOString()
        deadlineDuration = null
      }
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("approveReplacementRequest: Error", error)
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("rejectReplacementRequest: Error", error)
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("requestReplacement: Error", error)
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

          await sql`
            DELETE FROM shift_assignments
            WHERE shift_id = ${shiftId}
          `
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("removeReplacementAssignment: Error", error)
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

    return replacements
  } catch (error) {
    console.error("getExpiredReplacements: Error", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes("Too Many")) {
      console.error("getExpiredReplacements: Rate limiting detected - too many requests")
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

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("reactivateApplication: Error", error)
    return { error: "Erreur lors de la réactivation" }
  }
}
