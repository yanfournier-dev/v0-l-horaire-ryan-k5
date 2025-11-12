"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { createNotification, sendBatchReplacementEmails } from "@/app/actions/notifications"
import { sendEmail, getApplicationApprovedEmail, getApplicationRejectedEmail } from "@/lib/email"

// Apply for a replacement
export async function applyForReplacement(replacementId: number, firefighterId?: number | null) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    const applicantId = firefighterId ?? user.id

    if (firefighterId && firefighterId !== user.id && !user.is_admin) {
      return { error: "Non autorisé" }
    }

    const replacement = await sql`
      SELECT id, status FROM replacements WHERE id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    if (replacement[0].status !== "open") {
      return { error: "Ce remplacement n'est plus disponible" }
    }

    const existing = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${applicantId}
    `

    if (existing.length > 0) {
      return { error: "Candidature déjà enregistrée pour ce remplacement" }
    }

    await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${applicantId}, 'pending')
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error applying for replacement:", error)
    return { error: "Erreur lors de la candidature" }
  }
}

// Approve an application
export async function approveApplication(applicationId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacement_applications
      SET status = 'approved'
      WHERE id = ${applicationId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error approving application:", error)
    return { error: "Erreur lors de l'approbation" }
  }
}

// Reject an application
export async function rejectApplication(applicationId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected'
      WHERE id = ${applicationId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error rejecting application:", error)
    return { error: "Erreur lors du rejet" }
  }
}

export async function sendAssignmentNotifications(replacementId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    const replacement = await sql`
      SELECT 
        r.id,
        r.shift_date,
        r.shift_type,
        r.partial_start_hour,
        r.partial_end_hour,
        u.id as replaced_firefighter_id,
        u.first_name as replaced_first_name,
        u.last_name as replaced_last_name
      FROM replacements r
      LEFT JOIN users u ON r.original_firefighter_id = u.id
      WHERE r.id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const replacementData = replacement[0]

    const applications = await sql`
      SELECT 
        ra.id,
        ra.status,
        ra.applicant_id,
        u.email,
        u.first_name,
        u.last_name,
        np.notify_replacement_assigned_in_app,
        np.notify_replacement_assigned_email,
        np.notify_replacement_assigned_sms
      FROM replacement_applications ra
      JOIN users u ON ra.applicant_id = u.id
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE ra.replacement_id = ${replacementId}
        AND ra.status IN ('approved', 'rejected')
    `

    if (applications.length === 0) {
      return { error: "Aucune candidature approuvée ou refusée trouvée" }
    }

    // Create in-app notifications for users who want them
    const inAppNotifications = applications.filter(
      (app) =>
        (app.status === "approved" && app.notify_replacement_assigned_in_app) ||
        (app.status === "rejected" && app.notify_replacement_assigned_in_app),
    )

    for (const app of inAppNotifications) {
      await createNotification(
        app.applicant_id,
        app.status === "approved" ? "replacement_assigned" : "application_rejected",
        app.status === "approved"
          ? `Votre candidature a été approuvée pour le remplacement du ${new Date(replacementData.shift_date).toLocaleDateString("fr-CA")}.`
          : `Votre candidature a été refusée pour le remplacement du ${new Date(replacementData.shift_date).toLocaleDateString("fr-CA")}.`,
      )
    }

    // Send emails to users who want them
    const emailRecipients = applications.filter(
      (app) =>
        (app.status === "approved" && app.notify_replacement_assigned_email) ||
        (app.status === "rejected" && app.notify_replacement_assigned_email),
    )

    if (emailRecipients.length > 0) {
      for (const recipient of emailRecipients) {
        const emailContent =
          recipient.status === "approved"
            ? getApplicationApprovedEmail({
                replacementId: replacementData.id,
                shiftDate: replacementData.shift_date,
                shiftType: replacementData.shift_type,
                partialStartHour: replacementData.partial_start_hour,
                partialEndHour: replacementData.partial_end_hour,
                replacedFirefighterName:
                  replacementData.replaced_first_name && replacementData.replaced_last_name
                    ? `${replacementData.replaced_first_name} ${replacementData.replaced_last_name}`
                    : "N/A",
              })
            : getApplicationRejectedEmail({
                replacementId: replacementData.id,
                shiftDate: replacementData.shift_date,
                shiftType: replacementData.shift_type,
              })

        await sendEmail(recipient.email, emailContent.subject, emailContent.html)
      }
    }

    // TODO: Send SMS to users who want them (when Twilio is configured)

    // Mark notifications as sent
    await sql`
      UPDATE replacements
      SET notifications_sent_at = NOW()
      WHERE id = ${replacementId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true, sentCount: emailRecipients.length + inAppNotifications.length }
  } catch (error) {
    console.error("[v0] Error sending assignment notifications:", error)
    return { error: "Erreur lors de l'envoi des notifications" }
  }
}

export async function sendAllPendingNotifications() {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    const pendingReplacements = await sql`
      SELECT DISTINCT r.id
      FROM replacements r
      JOIN replacement_applications ra ON r.id = ra.replacement_id
      WHERE ra.status IN ('approved', 'rejected')
        AND r.notifications_sent_at IS NULL
    `

    if (pendingReplacements.length === 0) {
      return { error: "Aucune notification en attente" }
    }

    let totalSent = 0
    for (const replacement of pendingReplacements) {
      const result = await sendAssignmentNotifications(replacement.id)
      if (result.success && result.sentCount) {
        totalSent += result.sentCount
      }
    }

    return { success: true, count: totalSent }
  } catch (error) {
    console.error("[v0] Error sending all pending notifications:", error)
    return { error: "Erreur lors de l'envoi des notifications" }
  }
}

// Create a replacement from a shift
export async function createReplacementFromShift(data: {
  shiftDate: string
  shiftType: string
  originalFirefighterId?: number | null
  partialStartHour?: number | null
  partialEndHour?: number | null
  reason?: string | null
}) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    const result = await sql`
      INSERT INTO replacements (
        shift_date,
        shift_type,
        original_firefighter_id,
        partial_start_hour,
        partial_end_hour,
        reason,
        status,
        created_by_admin_id
      )
      VALUES (
        ${data.shiftDate},
        ${data.shiftType},
        ${data.originalFirefighterId},
        ${data.partialStartHour},
        ${data.partialEndHour},
        ${data.reason},
        'open',
        ${user.is_admin ? user.id : null}
      )
      RETURNING id
    `

    const replacementId = result[0].id

    // Send notifications for new replacement (this remains automatic)
    if (process.env.NODE_ENV === "production") {
      try {
        const emailResult = await sendBatchReplacementEmails(replacementId)
        console.log("[v0] PRODUCTION: sendBatchEmails returned:", emailResult)
      } catch (emailError) {
        console.error("[v0] PRODUCTION ERROR: Batch emails failed, notifying admins...", emailError)
      }
    }

    invalidateCache()
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    return { success: true, replacementId }
  } catch (error) {
    console.error("[v0] Error creating replacement:", error)
    return { error: "Erreur lors de la création du remplacement" }
  }
}

// Create extra firefighter replacement
export async function createExtraFirefighterReplacement(data: {
  shiftDate: string
  shiftType: string
  reason?: string | null
}) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    const result = await sql`
      INSERT INTO replacements (
        shift_date,
        shift_type,
        original_firefighter_id,
        reason,
        status,
        created_by_admin_id,
        is_extra_firefighter
      )
      VALUES (
        ${data.shiftDate},
        ${data.shiftType},
        NULL,
        ${data.reason},
        'open',
        ${user.id},
        true
      )
      RETURNING id
    `

    const replacementId = result[0].id

    if (process.env.NODE_ENV === "production") {
      try {
        await sendBatchReplacementEmails(replacementId)
      } catch (emailError) {
        console.error("[v0] Error sending batch emails:", emailError)
      }
    }

    invalidateCache()
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    return { success: true, replacementId }
  } catch (error) {
    console.error("[v0] Error creating extra firefighter replacement:", error)
    return { error: "Erreur lors de la création du remplacement" }
  }
}

// Delete a replacement
export async function deleteReplacement(replacementId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`DELETE FROM replacement_applications WHERE replacement_id = ${replacementId}`
    await sql`DELETE FROM replacements WHERE id = ${replacementId}`

    invalidateCache()
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error deleting replacement:", error)
    return { error: "Erreur lors de la suppression" }
  }
}

// Update replacement assignment
export async function updateReplacementAssignment(replacementId: number, replacementFirefighterId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacements
      SET replacement_firefighter_id = ${replacementFirefighterId}, status = 'assigned'
      WHERE id = ${replacementId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating assignment:", error)
    return { error: "Erreur lors de la mise à jour" }
  }
}

// Remove replacement assignment
export async function removeReplacementAssignment(replacementId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacements
      SET replacement_firefighter_id = NULL, status = 'open'
      WHERE id = ${replacementId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error removing assignment:", error)
    return { error: "Erreur lors de la suppression de l'assignation" }
  }
}

// Get available firefighters for a replacement
export async function getAvailableFirefighters(replacementId: number) {
  try {
    const firefighters = await sql`
      SELECT id, first_name, last_name, email, role
      FROM users
      WHERE role = 'firefighter'
      ORDER BY last_name, first_name
    `

    return { success: true, firefighters }
  } catch (error) {
    console.error("[v0] Error getting available firefighters:", error)
    return { error: "Erreur lors de la récupération des pompiers" }
  }
}

// Approve replacement request
export async function approveReplacementRequest(requestId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacement_requests
      SET status = 'approved'
      WHERE id = ${requestId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error approving request:", error)
    return { error: "Erreur lors de l'approbation" }
  }
}

// Reject replacement request
export async function rejectReplacementRequest(requestId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacement_requests
      SET status = 'rejected'
      WHERE id = ${requestId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error rejecting request:", error)
    return { error: "Erreur lors du rejet" }
  }
}

// Reactivate application
export async function reactivateApplication(applicationId: number) {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      UPDATE replacement_applications
      SET status = 'pending'
      WHERE id = ${applicationId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error reactivating application:", error)
    return { error: "Erreur lors de la réactivation" }
  }
}

// Request replacement
export async function requestReplacement(data: {
  shiftDate: string
  shiftType: string
  reason?: string
}) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    await sql`
      INSERT INTO replacement_requests (
        user_id,
        shift_date,
        shift_type,
        reason,
        status
      )
      VALUES (
        ${user.id},
        ${data.shiftDate},
        ${data.shiftType},
        ${data.reason},
        'pending'
      )
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error requesting replacement:", error)
    return { error: "Erreur lors de la demande" }
  }
}

// Get replacements for a shift
export async function getReplacementsForShift(shiftDate: string, shiftType: string) {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        u1.first_name as original_first_name,
        u1.last_name as original_last_name,
        u2.first_name as replacement_first_name,
        u2.last_name as replacement_last_name
      FROM replacements r
      LEFT JOIN users u1 ON r.original_firefighter_id = u1.id
      LEFT JOIN users u2 ON r.replacement_firefighter_id = u2.id
      WHERE r.shift_date = ${shiftDate}
        AND r.shift_type = ${shiftType}
      ORDER BY r.created_at DESC
    `

    return { success: true, replacements }
  } catch (error) {
    console.error("[v0] Error getting replacements for shift:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Withdraw application
export async function withdrawApplication(applicationId: number) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    const application = await sql`
      SELECT applicant_id FROM replacement_applications WHERE id = ${applicationId}
    `

    if (application.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    if (application[0].applicant_id !== user.id && !user.is_admin) {
      return { error: "Non autorisé" }
    }

    await sql`
      DELETE FROM replacement_applications WHERE id = ${applicationId}
    `

    invalidateCache()
    revalidatePath("/dashboard/replacements")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error withdrawing application:", error)
    return { error: "Erreur lors du retrait" }
  }
}

// Get user applications
export async function getUserApplications() {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    const applications = await sql`
      SELECT 
        ra.*,
        r.shift_date,
        r.shift_type,
        r.status as replacement_status
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.applicant_id = ${user.id}
      ORDER BY r.shift_date DESC
    `

    return { success: true, applications }
  } catch (error) {
    console.error("[v0] Error getting user applications:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Get recent replacements
export async function getRecentReplacements(limit = 10) {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        u1.first_name as original_first_name,
        u1.last_name as original_last_name,
        u2.first_name as replacement_first_name,
        u2.last_name as replacement_last_name
      FROM replacements r
      LEFT JOIN users u1 ON r.original_firefighter_id = u1.id
      LEFT JOIN users u2 ON r.replacement_firefighter_id = u2.id
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `

    return { success: true, replacements }
  } catch (error) {
    console.error("[v0] Error getting recent replacements:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Get all replacements
export async function getAllReplacements() {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        u1.first_name as original_first_name,
        u1.last_name as original_last_name,
        u2.first_name as replacement_first_name,
        u2.last_name as replacement_last_name
      FROM replacements r
      LEFT JOIN users u1 ON r.original_firefighter_id = u1.id
      LEFT JOIN users u2 ON r.replacement_firefighter_id = u2.id
      ORDER BY r.shift_date DESC, r.created_at DESC
    `

    return { success: true, replacements }
  } catch (error) {
    console.error("[v0] Error getting all replacements:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Get pending replacement requests
export async function getPendingReplacementRequests() {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { error: "Non autorisé" }
    }

    const requests = await sql`
      SELECT 
        rr.*,
        u.first_name,
        u.last_name,
        u.email
      FROM replacement_requests rr
      JOIN users u ON rr.user_id = u.id
      WHERE rr.status = 'pending'
      ORDER BY rr.shift_date ASC
    `

    return { success: true, requests }
  } catch (error) {
    console.error("[v0] Error getting pending requests:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Get user replacement requests
export async function getUserReplacementRequests() {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non authentifié" }
    }

    const requests = await sql`
      SELECT * FROM replacement_requests
      WHERE user_id = ${user.id}
      ORDER BY shift_date DESC
    `

    return { success: true, requests }
  } catch (error) {
    console.error("[v0] Error getting user requests:", error)
    return { error: "Erreur lors de la récupération" }
  }
}

// Get expired replacements
export async function getExpiredReplacements() {
  try {
    const replacements = await sql`
      SELECT 
        r.*,
        u1.first_name as original_first_name,
        u1.last_name as original_last_name
      FROM replacements r
      LEFT JOIN users u1 ON r.original_firefighter_id = u1.id
      WHERE r.status = 'open'
        AND r.shift_date < CURRENT_DATE
      ORDER BY r.shift_date DESC
    `

    return { success: true, replacements }
  } catch (error) {
    console.error("[v0] Error getting expired replacements:", error)
    return { error: "Erreur lors de la récupération" }
  }
}
