"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { createNotification, sendBatchReplacementEmails, createBatchNotificationsInApp } from "./notifications"
import { calculateAutoDeadline, formatLocalDate, calculateEndOfShiftDeadline } from "@/lib/date-utils"
import { revalidatePath } from "next/cache"
import { neon } from "@neondatabase/serverless"
import { createAuditLog } from "./audit"
import { checkConsecutiveHours } from "@/lib/consecutive-hours"

const getDeadlineLabel = (deadlineSeconds: number | null | undefined): string | null => {
  if (deadlineSeconds === 900) return "Délai: 15 minutes"
  if (deadlineSeconds === 86400) return "Délai: 24 heures"
  if (deadlineSeconds === -1) return "Sans délai"
  // Don't send notifications for other deadline types (-2 or any other values)
  return null
}

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
      WHERE r.status = 'open'
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

export async function createReplacementFromShift(
  userId: number,
  shiftDate: string,
  shiftType: "day" | "night" | "full_24h",
  teamId: number,
  isPartial: boolean,
  startTime?: string | null,
  endTime?: string | null,
  deadlineSeconds?: number | null,
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  leaveBank1?: string | null,
  leaveHours1?: string | null,
  leaveBank2?: string | null,
  leaveHours2?: string | null,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    let applicationDeadline: string

    let deadlineDuration: number | null = deadlineSeconds ?? null

    if (typeof deadlineSeconds === "number" && deadlineSeconds > 0) {
      // Fixed deadline in seconds from now
      const deadline = new Date(Date.now() + deadlineSeconds * 1000)
      applicationDeadline = deadline.toISOString()
    } else if (deadlineSeconds === -1) {
      // First-come, first-served: deadline is end of shift
      if (!shiftStartTime || !shiftEndTime) {
        throw new Error("Start time and end time required for first-come deadline")
      }

      const calcStartTime = shiftStartTime
      const calcEndTime = shiftEndTime
      applicationDeadline = calculateEndOfShiftDeadline(shiftDate, calcEndTime, calcStartTime)
    } else if (deadlineSeconds === -2) {
      const shiftYear = new Date(shiftDate).getFullYear()
      // Create date in local timezone (Eastern Time)
      const summerDeadline = new Date(shiftYear, 4, 16, 0, 0, 0, 0) // Month is 0-indexed, so 4 = May
      applicationDeadline = summerDeadline.toISOString()
    } else if (deadlineSeconds === null || deadlineSeconds === undefined) {
      applicationDeadline = calculateAutoDeadline(shiftDate)
      deadlineDuration = null
    }

    const result = await db`
      INSERT INTO replacements (
        shift_date, shift_type, team_id, status, is_partial, start_time, end_time, user_id,
        application_deadline, deadline_duration, leave_bank_1, leave_hours_1, leave_bank_2, leave_hours_2
      )
      VALUES (
        ${shiftDate}, ${shiftType}, ${teamId}, 'open',
        ${isPartial}, ${isPartial ? startTime : null}, ${isPartial ? endTime : null}, ${userId},
        ${applicationDeadline}, ${deadlineDuration}, ${leaveBank1}, ${leaveHours1}, ${leaveBank2}, ${leaveHours2}
      )
      RETURNING id
    `

    const replacementId = result[0].id

    const firefighterInfo = await db`
      SELECT first_name, last_name FROM users WHERE id = ${userId}
    `
    const firefighterToReplaceName =
      firefighterInfo.length > 0 ? `${firefighterInfo[0].first_name} ${firefighterInfo[0].last_name}` : "Pompier"

    const deadlineLabel = getDeadlineLabel(deadlineSeconds)
    const shouldSendNotifications = deadlineLabel !== null

    const eligibleUsers = await db`
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

    if (eligibleUsers.length > 0 && shouldSendNotifications) {
      const userIds = eligibleUsers.map((u) => u.id)
      const notificationTitle =
        deadlineLabel === "Sans délai"
          ? "🚨 SANS DÉLAI - Nouveau remplacement"
          : `Nouveau remplacement - Délai: ${deadlineLabel}`

      createBatchNotificationsInApp(
        userIds,
        notificationTitle,
        `Remplacement pour ${firefighterToReplaceName} le ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})`,
        "replacement_available",
        replacementId,
        "replacement",
      ).catch((error) => {
        console.error("Background notification creation failed:", error)
      })
    }

    let emailResults
    if (process.env.VERCEL_ENV === "production" && shouldSendNotifications) {
      emailResults = await sendBatchReplacementEmails(replacementId, firefighterToReplaceName, deadlineLabel!)
    } else {
      // In preview, simulate email sending
      emailResults = {
        success: true,
        sent: shouldSendNotifications ? eligibleUsers.length : 0,
        failed: 0,
        recipients: shouldSendNotifications
          ? eligibleUsers.map((u: any) => ({
              userId: u.id,
              success: true,
            }))
          : [],
      }
    }

    await createAuditLog({
      userId: user.id,
      actionType: "REPLACEMENT_CREATED",
      tableName: "replacements",
      recordId: replacementId,
      description: `Demande de remplacement créée pour ${firefighterToReplaceName} le ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})${isPartial && startTime && endTime ? ` (${startTime.slice(0, 5)}-${endTime.slice(0, 5)})` : ""}`,
    })

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true, id: replacementId, emailResults }
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacement = await db`
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

    const existingApplication = await db`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${applicantId}
    `

    if (existingApplication.length > 0) {
      return { error: "Ce pompier a déjà postulé pour ce remplacement" }
    }

    const insertResult = await db`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${applicantId}, 'pending')
      RETURNING applied_at
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    await db`
      DELETE FROM replacement_applications
      WHERE id = ${applicationId} AND applicant_id = ${user.id}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("withdrawApplication: Error", error)
    return { error: "Erreur lors du retrait de la candidature" }
  }
}

export async function approveApplication(
  applicationId: number,
  replacementId: number,
  forceAssign = false, // Added parameter to bypass consecutive hours check
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  console.log("[v0] approveApplication called - applicationId:", applicationId, "forceAssign:", forceAssign)

  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const appResult = await db`
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

    console.log("[v0] About to check consecutive hours for applicant:", applicantId, "forceAssign:", forceAssign)

    let shiftDateStr = shift_date // Declare shiftDateStr here

    if (!forceAssign) {
      shiftDateStr = new Date(shift_date).toISOString().split("T")[0] // Assign to shiftDateStr here
      const consecutiveCheck = await checkConsecutiveHours(
        applicantId,
        shiftDateStr,
        shift_type,
        is_partial || false,
        start_time,
        end_time,
      )

      console.log("[v0] Consecutive check result:", consecutiveCheck)

      if (consecutiveCheck.exceeds) {
        console.log("[v0] Returning CONSECUTIVE_HOURS_EXCEEDED error")
        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: consecutiveCheck.message,
          totalHours: consecutiveCheck.totalHours,
        }
      }
    } else {
      console.log("[v0] Skipping consecutive hours check (forceAssign=true)")
    }

    const cycleConfig = await db`
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

    const shiftResult = await db`
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

    const users = await db`
      SELECT id, first_name, last_name FROM users
      WHERE id IN (${applicantId}, ${replacedUserId})
    `
    const applicant = users.find((u: any) => u.id === applicantId)
    const replaced = users.find((u: any) => u.id === replacedUserId)

    await db`
      UPDATE replacement_applications
      SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    await db`
      UPDATE replacement_applications
      SET status = 'rejected'
      WHERE replacement_id = ${replacementId} AND id != ${applicationId}
    `

    await db`
      UPDATE replacements
      SET status = 'assigned'
      WHERE id = ${replacementId}
    `

    // Delete any existing assignments first to avoid conflicts
    await db`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId}
        AND user_id = ${applicantId}
    `

    // Then insert the new assignment
    await db`
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
        ${applicantId}, 
        ${replacedUserId},
        false, 
        false,
        ${is_partial || false},
        ${start_time || null},
        ${end_time || null},
        1,
        ${shiftDateStr}
      )
    `

    await createNotification(
      applicantId,
      "Remplacement assigné",
      `Vous avez été assigné au remplacement du ${formatLocalDate(shift_date)} (${shift_type === "day" ? "Jour" : "Nuit"})`,
      "application_approved",
      replacementId,
      "replacement",
    )

    await createAuditLog({
      userId: user.id,
      actionType: "REPLACEMENT_APPROVED",
      tableName: "replacement_applications",
      recordId: applicationId,
      description: `Demande de remplacement approuvée: ${applicant?.first_name} ${applicant?.last_name} remplace ${replaced?.first_name} ${replaced?.last_name} le ${formatLocalDate(shift_date)} (${shift_type === "day" ? "Jour" : "Nuit"})`,
    })

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true, shiftId, shiftDate: shiftDateStr }
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const appResult = await db`
      SELECT applicant_id FROM replacement_applications WHERE id = ${applicationId}
    `

    if (appResult.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const applicantId = appResult[0].applicant_id

    const applicantInfo = await db`
      SELECT first_name, last_name FROM users WHERE id = ${applicantId}
    `

    await db`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    if (applicantInfo.length > 0) {
      await createAuditLog({
        userId: user.id,
        actionType: "REPLACEMENT_REJECTED",
        tableName: "replacement_applications",
        recordId: applicationId,
        description: `Candidature rejetée: ${applicantInfo[0].first_name} ${applicantInfo[0].last_name}`,
      })
    }

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
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacementDetails = await db`
      SELECT r.*, u.first_name, u.last_name
      FROM replacements r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ${replacementId}
    `

    if (replacementDetails.length > 0) {
      const { shift_date, shift_type, team_id } = replacementDetails[0]

      const cycleConfig = await db`
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

        const shiftResult = await db`
          SELECT id FROM shifts
          WHERE team_id = ${team_id}
            AND cycle_day = ${cycleDay}
            AND shift_type = ${shift_type}
          LIMIT 1
        `

        if (shiftResult.length > 0) {
          const shiftId = shiftResult[0].id

          await db`
            DELETE FROM shift_assignments
            WHERE shift_id = ${shiftId}
          `
        }
      }
    }

    await db`
      DELETE FROM replacements WHERE id = ${replacementId}
    `

    if (replacementDetails.length > 0) {
      const replacement = replacementDetails[0]
      await createAuditLog({
        userId: user.id,
        actionType: "REPLACEMENT_DELETED",
        tableName: "replacements",
        recordId: replacementId,
        description: `Demande de remplacement supprimée pour ${replacement.first_name || ""} ${replacement.last_name || ""} le ${new Date(replacement.shift_date).toLocaleDateString("fr-CA")} (${replacement.shift_type === "day" ? "Jour" : "Nuit"})`,
        oldValues: replacement,
      })
    }

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
    } catch (cacheError) {
      console.error("deleteReplacement - Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("deleteReplacement: Error", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function createExtraFirefighterReplacement(
  shiftDate: string,
  shiftType: "day" | "night" | "full_24h",
  teamId: number,
  isPartial: boolean,
  startTime?: string | null,
  endTime?: string | null,
  deadlineSeconds?: number | null,
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    console.log("[v0] createExtraFirefighterReplacement - Starting with params:", {
      shiftDate,
      shiftType,
      teamId,
      isPartial,
      startTime,
      endTime,
      deadlineSeconds,
    })

    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    let applicationDeadline: string

    let deadlineDuration: number | null = deadlineSeconds ?? null

    if (typeof deadlineSeconds === "number" && deadlineSeconds > 0) {
      // Fixed deadline in seconds from now
      const deadline = new Date(Date.now() + deadlineSeconds * 1000)
      applicationDeadline = deadline.toISOString()
    } else if (deadlineSeconds === -1) {
      // First-come, first-served: deadline is end of shift
      if (!shiftStartTime || !shiftEndTime) {
        throw new Error("Start time and end time required for first-come deadline")
      }

      const calcStartTime = shiftStartTime
      const calcEndTime = shiftEndTime
      applicationDeadline = calculateEndOfShiftDeadline(shiftDate, calcEndTime, calcStartTime)
    } else if (deadlineSeconds === -2) {
      const shiftYear = new Date(shiftDate).getFullYear()
      // Create date in local timezone (Eastern Time)
      const summerDeadline = new Date(shiftYear, 4, 16, 0, 0, 0, 0) // Month is 0-indexed, so 4 = May
      applicationDeadline = summerDeadline.toISOString()
    } else if (deadlineSeconds === null || deadlineSeconds === undefined) {
      applicationDeadline = calculateAutoDeadline(shiftDate)
      deadlineDuration = null
    }

    console.log("[v0] createExtraFirefighterReplacement - Calculated deadline:", {
      applicationDeadline,
      deadlineDuration,
    })

    const result = await db`
      INSERT INTO replacements (
        shift_date, shift_type, team_id, status, is_partial, start_time, end_time,
        application_deadline, deadline_duration
      )
      VALUES (
        ${shiftDate}, ${shiftType}, ${teamId}, 'open',
        ${isPartial}, ${isPartial ? startTime : null}, ${isPartial ? endTime : null},
        ${applicationDeadline}, ${deadlineDuration}
      )
      RETURNING id
    `

    const replacementId = result[0].id

    console.log("[v0] createExtraFirefighterReplacement - Created replacement with ID:", replacementId)

    const firefighterToReplaceName = "Pompier supplémentaire"

    const deadlineLabel = getDeadlineLabel(deadlineSeconds)
    const shouldSendNotifications = deadlineLabel !== null

    const eligibleUsers = await db`
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

    if (eligibleUsers.length > 0 && shouldSendNotifications) {
      const userIds = eligibleUsers.map((u) => u.id)
      const notificationTitle =
        deadlineLabel === "Sans délai"
          ? "🚨 SANS DÉLAI - Nouveau remplacement"
          : `Nouveau remplacement - Délai: ${deadlineLabel}`

      createBatchNotificationsInApp(
        userIds,
        notificationTitle,
        `Remplacement (pompier supplémentaire) le ${formatLocalDate(shiftDate)} (${shiftType === "day" ? "Jour" : "Nuit"})`,
        "replacement_available",
        replacementId,
        "replacement",
      ).catch((error) => {
        console.error("Background notification creation failed:", error)
      })
    }

    if (process.env.VERCEL_ENV === "production" && shouldSendNotifications) {
      sendBatchReplacementEmails(replacementId, firefighterToReplaceName, deadlineLabel!).catch((error) => {
        console.error("PRODUCTION: Batch email sending failed:", error)
      })
    }

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    if (assignedTo) {
      await db`
        INSERT INTO replacement_applications (replacement_id, applicant_id, status, reviewed_by, reviewed_at)
        VALUES (${replacementId}, ${assignedTo}, 'approved', ${user.id}, CURRENT_TIMESTAMP)
        ON CONFLICT (replacement_id, applicant_id) 
        DO UPDATE SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      `

      await db`
        UPDATE replacement_applications
        SET status = 'rejected'
        WHERE replacement_id = ${replacementId} AND applicant_id != ${assignedTo}
      `

      await db`
        UPDATE replacements
        SET status = 'assigned'
        WHERE id = ${replacementId}
      `
    } else {
      await db`
        UPDATE replacement_applications
        SET status = 'rejected'
        WHERE replacement_id = ${replacementId} AND status = 'approved'
      `

      await db`
        UPDATE replacement_applications
        SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
        WHERE replacement_id = ${replacementId} AND status = 'rejected'
      `

      await db`
        UPDATE replacements
        SET status = 'open'
        WHERE id = ${replacementId}
      `
    }

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacement = await db`
      SELECT shift_date, shift_type FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      console.error("getAvailableFirefighters: Replacement not found")
      return []
    }

    const { shift_date: shiftDate } = replacement[0]

    const firefighters = await db`
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

export async function approveReplacementRequest(replacementId: number, deadlineSeconds?: number | null) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacement = await db`
      SELECT shift_date FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const shiftDate = replacement[0].shift_date

    let applicationDeadline: string

    let deadlineDuration: number | null = deadlineSeconds ?? null

    if (typeof deadlineSeconds === "number" && deadlineSeconds > 0) {
      // Fixed deadline in seconds from now
      const deadline = new Date(Date.now() + deadlineSeconds * 1000)
      applicationDeadline = deadline.toISOString()
    } else if (deadlineSeconds === -1) {
      // First-come, first-served: deadline is end of shift
      const startTime = "00:00" // Declare startTime here
      const endTime = "23:59" // Declare endTime here
      applicationDeadline = calculateEndOfShiftDeadline(shiftDate, endTime, startTime)
    } else if (deadlineSeconds === -2) {
      const shiftYear = new Date(shiftDate).getFullYear()
      // Create date in local timezone (Eastern Time)
      const summerDeadline = new Date(shiftYear, 4, 16, 0, 0, 0, 0) // Month is 0-indexed, so 4 = May
      applicationDeadline = summerDeadline.toISOString()
    } else if (deadlineSeconds === null || deadlineSeconds === undefined) {
      applicationDeadline = calculateAutoDeadline(shiftDate)
      deadlineDuration = null
    }

    // Add deadline_duration to the UPDATE statement
    await db`
      UPDATE replacements
      SET status = 'open', 
          application_deadline = ${applicationDeadline},
          deadline_duration = ${deadlineDuration}
      WHERE id = ${replacementId}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    await db`
      UPDATE replacements
      SET status = 'cancelled'
      WHERE id = ${replacementId}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
  shiftType: "day" | "night" | "full_24h",
  teamId: number,
  isPartial: boolean,
  startTime?: string | null,
  endTime?: string | null,
) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  if (!shiftDate || !shiftType || !teamId) {
    return { error: "Tous les champs sont requis" }
  }

  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    await db`
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
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacementDetails = await db`
      SELECT r.shift_date, r.shift_type, r.team_id, ra.applicant_id, 
             req_user.first_name as requester_first_name, req_user.last_name as requester_last_name,
             app_user.first_name as applicant_first_name, app_user.last_name as applicant_last_name
      FROM replacements r
      LEFT JOIN users req_user ON r.user_id = req_user.id
      LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
      LEFT JOIN users app_user ON ra.applicant_id = app_user.id
      WHERE r.id = ${replacementId}
    `

    if (replacementDetails.length > 0) {
      const { shift_date, shift_type, team_id, applicant_id } = replacementDetails[0]

      const cycleConfig = await db`
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

        const shiftResult = await db`
          SELECT id FROM shifts
          WHERE team_id = ${team_id}
            AND cycle_day = ${cycleDay}
            AND shift_type = ${shift_type}
          LIMIT 1
        `

        if (shiftResult.length > 0) {
          const shiftId = shiftResult[0].id

          await db`
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

      const detail = replacementDetails[0]
      await createAuditLog({
        userId: user.id,
        actionType: "CANDIDATE_REMOVED",
        tableName: "shift_assignments",
        recordId: replacementId,
        description: `Candidat assigné retiré: ${detail.applicant_first_name || ""} ${detail.applicant_last_name || ""} pour ${detail.requester_first_name || ""} ${detail.requester_last_name || ""} le ${new Date(shift_date).toLocaleDateString("fr-CA")} (${shift_type === "day" ? "Jour" : "Nuit"})`,
      })
    }

    await db`
      UPDATE replacement_applications
      SET status = 'rejected'
      WHERE replacement_id = ${replacementId} AND status = 'approved'
    `

    await db`
      UPDATE replacement_applications
      SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
      WHERE replacement_id = ${replacementId} AND status = 'rejected'
    `

    await db`
      UPDATE replacements
      SET status = 'open'
      WHERE id = ${replacementId}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacements = await db`
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
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const appResult = await db`
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

    await db`
      UPDATE replacement_applications
      SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
      WHERE id = ${applicationId}
    `

    try {
      invalidateCache()
      revalidatePath("/dashboard/calendar")
      revalidatePath("/dashboard")
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("reactivateApplication: Error", error)
    return { error: "Erreur lors de la réactivation" }
  }
}

export async function getReplacementsForShift(shiftDate: string, shiftType: string, teamId: number) {
  try {
    console.log("[v0] getReplacementsForShift - Fetching for:", { shiftDate, shiftType, teamId })

    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const replacements = await db`
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

    console.log("[v0] getReplacementsForShift - Found", replacements.length, "replacements")
    const extraFirefighters = replacements.filter((r: any) => r.user_id === null)
    console.log("[v0] getReplacementsForShift - Extra firefighters (user_id=null):", extraFirefighters.length)
    extraFirefighters.forEach((ef: any, index: number) => {
      console.log(`[v0] Extra firefighter ${index + 1}:`, {
        id: ef.id,
        status: ef.status,
        is_partial: ef.is_partial,
        start_time: ef.start_time,
        end_time: ef.end_time,
        application_deadline: ef.application_deadline,
      })
    })

    return replacements.map((r) => ({
      ...r,
      applications: r.applications || [],
    }))
  } catch (error) {
    console.error("getReplacementsForShift: Error", error)
    return []
  }
}

export async function getUserReplacementRequests(userId: number) {
  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const requests = await db`
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

export async function getDirectAssignments() {
  try {
    const db = neon(process.env.DATABASE_URL!, {
      fetchConnectionCache: true,
      disableWarningInBrowsers: true,
    })

    const assignments = await db`
      SELECT 
        sa.id,
        sa.shift_id,
        sa.user_id,
        sa.replaced_user_id,
        sa.is_partial,
        sa.start_time,
        sa.end_time,
        sa.replacement_order,
        sa.shift_date,
        sa.assigned_at,
        sa.is_acting_lieutenant,
        sa.is_acting_captain,
        sa.is_direct_assignment,
        s.shift_type,
        s.cycle_day,
        s.team_id,
        t.name as team_name,
        t.color as team_color,
        assigned_user.first_name as assigned_first_name,
        assigned_user.last_name as assigned_last_name,
        replaced_user.first_name as replaced_first_name,
        replaced_user.last_name as replaced_last_name
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN teams t ON s.team_id = t.id
      LEFT JOIN users assigned_user ON sa.user_id = assigned_user.id
      LEFT JOIN users replaced_user ON sa.replaced_user_id = replaced_user.id
      WHERE (sa.is_direct_assignment = true OR sa.replacement_order = 2)
      ORDER BY sa.shift_date ASC, s.shift_type
    `

    return assignments
  } catch (error) {
    console.error("getDirectAssignments: Error", error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getReplacementsAdminActionCount() {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return 0
    }

    // Count pending requests
    const pendingRequests = await sql`
      SELECT COUNT(*) as count
      FROM replacements r
      LEFT JOIN leaves l ON r.leave_id = l.id
      WHERE (r.status = 'pending' OR (r.status = 'open' AND l.status = 'pending'))
        AND r.shift_date >= CURRENT_DATE
    `

    // Count expired replacements (ready to assign) - must match getExpiredReplacements()
    const expiredReplacements = await sql`
      SELECT COUNT(*) as count
      FROM replacements
      WHERE status = 'open'
        AND application_deadline IS NOT NULL
        AND application_deadline < CURRENT_TIMESTAMP
        AND shift_date >= CURRENT_DATE - INTERVAL '7 days'
    `

    const totalCount = Number(pendingRequests[0]?.count || 0) + Number(expiredReplacements[0]?.count || 0)
    return totalCount
  } catch (error) {
    console.error("getReplacementsAdminActionCount: Error", error)
    return 0
  }
}

export async function getAssignedReplacements(
  dateFilter: "all" | "upcoming" | "7days" | "30days" = "upcoming",
  sortOrder: "asc" | "desc" = "asc",
) {
  try {
    let replacements

    // Base query parts
    const baseSelect = `
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
        sender.first_name as sent_by_first_name,
        sender.last_name as sent_by_last_name
      FROM replacements r
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN leaves l ON r.leave_id = l.id
      LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
      INNER JOIN replacement_applications ra_approved 
        ON r.id = ra_approved.replacement_id 
        AND ra_approved.status = 'approved'
      INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
      LEFT JOIN users sender ON r.notification_sent_by = sender.id
    `

    // Execute query based on filters
    if (dateFilter === "all") {
      if (sortOrder === "asc") {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          ORDER BY r.shift_date ASC, r.shift_type
        `
      } else {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          ORDER BY r.shift_date DESC, r.shift_type
        `
      }
    } else if (dateFilter === "upcoming") {
      if (sortOrder === "asc") {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE
          ORDER BY r.shift_date ASC, r.shift_type
        `
      } else {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE
          ORDER BY r.shift_date DESC, r.shift_type
        `
      }
    } else if (dateFilter === "7days") {
      if (sortOrder === "asc") {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY r.shift_date ASC, r.shift_type
        `
      } else {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY r.shift_date DESC, r.shift_type
        `
      }
    } else {
      // 30days
      if (sortOrder === "asc") {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY r.shift_date ASC, r.shift_type
        `
      } else {
        replacements = await sql`
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
            sender.first_name as sent_by_first_name,
            sender.last_name as sent_by_last_name,
            COALESCE(app_count.total_count, 0) as candidate_count
          FROM replacements r
          LEFT JOIN teams t ON r.team_id = t.id
          LEFT JOIN leaves l ON r.leave_id = l.id
          LEFT JOIN users replaced_user ON r.user_id = replaced_user.id
          INNER JOIN replacement_applications ra_approved 
            ON r.id = ra_approved.replacement_id 
            AND ra_approved.status = 'approved'
          INNER JOIN users replacement_user ON ra_approved.applicant_id = replacement_user.id
          LEFT JOIN users sender ON r.notification_sent_by = sender.id
          LEFT JOIN (
            SELECT replacement_id, COUNT(*) as total_count
            FROM replacement_applications
            GROUP BY replacement_id
          ) app_count ON app_count.replacement_id = r.id
          WHERE r.shift_date >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY r.shift_date DESC, r.shift_type
        `
      }
    }

    // Count total and unsent
    const totalCount = replacements.length
    const unsentCount = replacements.filter((r: any) => !r.notification_sent).length

    return {
      replacements,
      totalCount,
      unsentCount,
    }
  } catch (error) {
    console.error("getAssignedReplacements: Error", error instanceof Error ? error.message : String(error))
    return {
      replacements: [],
      totalCount: 0,
      unsentCount: 0,
    }
  }
}
