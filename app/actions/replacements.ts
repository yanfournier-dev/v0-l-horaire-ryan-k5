"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { parseLocalDate } from "@/lib/calendar"

export async function getOpenReplacements() {
  const replacements = await sql`
    SELECT 
      r.*,
      l.user_id as leave_user_id,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      t.name as team_name,
      t.type as team_type
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    WHERE r.status = 'open'
    ORDER BY r.shift_date ASC
  `
  return replacements
}

export async function getRecentReplacements() {
  const replacements = await sql`
    SELECT 
      r.*,
      l.user_id as leave_user_id,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      t.name as team_name,
      t.type as team_type,
      assigned_user.first_name as assigned_first_name,
      assigned_user.last_name as assigned_last_name,
      COUNT(DISTINCT ra.id) as application_count
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    LEFT JOIN replacement_applications ra_approved ON r.id = ra_approved.replacement_id AND ra_approved.status = 'approved'
    LEFT JOIN users assigned_user ON ra_approved.applicant_id = assigned_user.id
    LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id
    WHERE r.status IN ('open', 'assigned')
    GROUP BY r.id, l.user_id, leave_user.first_name, leave_user.last_name,
             direct_user.first_name, direct_user.last_name, t.name, t.type,
             assigned_user.first_name, assigned_user.last_name
    ORDER BY 
      CASE r.status 
        WHEN 'open' THEN 1 
        WHEN 'assigned' THEN 2 
      END,
      r.shift_date ASC
  `
  return replacements
}

export async function getAllReplacements() {
  const replacements = await sql`
    SELECT 
      r.*,
      l.user_id as leave_user_id,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      t.name as team_name,
      t.type as team_type,
      assigned_user.first_name as assigned_first_name,
      assigned_user.last_name as assigned_last_name,
      COUNT(ra.id) as application_count
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    LEFT JOIN replacement_applications ra_approved ON r.id = ra_approved.replacement_id AND ra_approved.status = 'approved'
    LEFT JOIN users assigned_user ON ra_approved.applicant_id = assigned_user.id
    LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id
    GROUP BY r.id, l.user_id, leave_user.first_name, leave_user.last_name, 
             direct_user.first_name, direct_user.last_name, t.name, t.type,
             assigned_user.first_name, assigned_user.last_name
    ORDER BY 
      CASE r.status 
        WHEN 'open' THEN 1 
        WHEN 'assigned' THEN 2 
        WHEN 'completed' THEN 3 
        WHEN 'cancelled' THEN 4 
      END,
      r.shift_date ASC
  `
  return replacements
}

export async function getReplacementApplications(replacementId: number) {
  const applications = await sql`
    SELECT 
      ra.*,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      reviewer.first_name as reviewer_first_name,
      reviewer.last_name as reviewer_last_name,
      t.name as team_name,
      t.type as team_type
    FROM replacement_applications ra
    JOIN users u ON ra.applicant_id = u.id
    LEFT JOIN users reviewer ON ra.reviewed_by = reviewer.id
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    WHERE ra.replacement_id = ${replacementId}
    ORDER BY 
      CASE 
        WHEN t.type = 'part_time' AND t.name LIKE '%1%' THEN 1
        WHEN t.type = 'part_time' AND t.name LIKE '%2%' THEN 2
        WHEN t.type = 'part_time' AND t.name LIKE '%3%' THEN 3
        WHEN t.type = 'part_time' AND t.name LIKE '%4%' THEN 4
        WHEN t.type = 'part_time' THEN 5
        WHEN t.type = 'temporary' THEN 6
        WHEN t.type = 'permanent' AND t.name LIKE '%1%' THEN 7
        WHEN t.type = 'permanent' AND t.name LIKE '%2%' THEN 8
        WHEN t.type = 'permanent' AND t.name LIKE '%3%' THEN 9
        WHEN t.type = 'permanent' AND t.name LIKE '%4%' THEN 10
        ELSE 11
      END,
      ra.applied_at DESC
  `
  return applications
}

export async function getUserApplications(userId: number) {
  const applications = await sql`
    SELECT 
      ra.*,
      r.shift_date,
      r.shift_type,
      r.status as replacement_status,
      t.name as team_name,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      reviewer.first_name as reviewer_first_name,
      reviewer.last_name as reviewer_last_name
    FROM replacement_applications ra
    JOIN replacements r ON ra.replacement_id = r.id
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    LEFT JOIN users reviewer ON ra.reviewed_by = reviewer.id
    WHERE ra.applicant_id = ${userId}
    ORDER BY ra.applied_at DESC
  `
  return applications
}

export async function applyForReplacement(replacementId: number, firefighterId?: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  // If firefighterId is provided, verify user is admin
  if (firefighterId && !user.is_admin) {
    return { error: "Non autorisé" }
  }

  const applicantId = firefighterId || user.id

  try {
    // Check if already applied
    const existing = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${applicantId}
    `

    if (existing.length > 0) {
      return {
        error: firefighterId
          ? "Ce pompier a déjà postulé pour ce remplacement"
          : "Vous avez déjà postulé pour ce remplacement",
      }
    }

    await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${applicantId}, 'pending')
    `
    revalidatePath("/dashboard/replacements")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la candidature" }
  }
}

export async function approveApplication(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Get the application details
    const application = await sql`
      SELECT replacement_id, applicant_id FROM replacement_applications
      WHERE id = ${applicationId}
    `

    if (application.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const { replacement_id, applicant_id } = application[0]

    const replacementResult = await sql`
      SELECT r.*, s.id as shift_id
      FROM replacements r
      LEFT JOIN shifts s ON s.team_id = r.team_id 
        AND s.shift_type = r.shift_type
        AND s.cycle_day = (
          SELECT (
            (r.shift_date::date - ci.start_date::date) % ci.cycle_length_days
          ) + 1
          FROM cycle_config ci
          WHERE ci.is_active = true
          LIMIT 1
        )
      WHERE r.id = ${replacement_id}
      LIMIT 1
    `
    const replacement = replacementResult[0]

    const existingAssignment = await sql`
      SELECT r.id, r.user_id
      FROM replacements r
      JOIN replacement_applications ra ON r.id = ra.replacement_id
      WHERE r.shift_date = ${replacement.shift_date}
        AND r.shift_type = ${replacement.shift_type}
        AND r.team_id = ${replacement.team_id}
        AND r.id != ${replacement_id}
        AND ra.applicant_id = ${applicant_id}
        AND ra.status = 'approved'
        AND r.status = 'assigned'
    `

    if (existingAssignment.length > 0) {
      return {
        error: "Ce pompier est déjà assigné à un autre remplacement pour ce quart",
      }
    }

    // Approve this application
    await sql`
      UPDATE replacement_applications
      SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    const otherApplicants = await sql`
      SELECT applicant_id FROM replacement_applications
      WHERE replacement_id = ${replacement_id} AND id != ${applicationId} AND status = 'pending'
    `

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE replacement_id = ${replacement_id} AND id != ${applicationId} AND status = 'pending'
    `

    // Update replacement status to assigned
    await sql`
      UPDATE replacements
      SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacement_id}
    `

    if (replacement.user_id === null && replacement.shift_id) {
      console.log("[v0] Creating shift_assignment for extra firefighter:", {
        shift_id: replacement.shift_id,
        applicant_id,
        is_partial: replacement.is_partial,
        start_time: replacement.start_time,
        end_time: replacement.end_time,
      })

      await sql`
        INSERT INTO shift_assignments (shift_id, user_id, is_extra, is_partial, start_time, end_time)
        VALUES (
          ${replacement.shift_id},
          ${applicant_id},
          true,
          ${replacement.is_partial || false},
          ${replacement.is_partial && replacement.start_time ? replacement.start_time : null},
          ${replacement.is_partial && replacement.end_time ? replacement.end_time : null}
        )
        ON CONFLICT (shift_id, user_id) DO UPDATE
        SET is_extra = true,
            is_partial = ${replacement.is_partial || false},
            start_time = ${replacement.is_partial && replacement.start_time ? replacement.start_time : null},
            end_time = ${replacement.is_partial && replacement.end_time ? replacement.end_time : null}
      `
    }

    await createNotification(
      applicant_id,
      "Candidature approuvée",
      `Votre candidature pour le remplacement du ${parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA")} a été approuvée.`,
      "application_approved",
      replacement_id,
      "replacement",
    )

    for (const applicant of otherApplicants) {
      await createNotification(
        applicant.applicant_id,
        "Candidature rejetée",
        `Votre candidature pour le remplacement du ${parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA")} a été rejetée.`,
        "application_rejected",
        replacement_id,
        "replacement",
      )
    }

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error approving application:", error)
    return { error: "Erreur lors de l'approbation" }
  }
}

export async function rejectApplication(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const application = await sql`
      SELECT ra.replacement_id, ra.applicant_id, r.shift_date, r.shift_type
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.id = ${applicationId}
    `

    if (application.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const { replacement_id, applicant_id, shift_date, shift_type } = application[0]

    await sql`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `

    const formattedDate = parseLocalDate(shift_date).toLocaleDateString("fr-CA")
    await createNotification(
      applicant_id,
      "Candidature rejetée",
      `Votre candidature pour le remplacement du ${formattedDate} (${shift_type === "day" ? "Jour" : "Nuit"}) a été rejetée.`,
      "application_rejected",
      replacement_id,
      "replacement",
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error rejecting application:", error)
    return { error: "Erreur lors du rejet" }
  }
}

export async function withdrawApplication(applicationId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    // Verify the application belongs to the user
    const application = await sql`
      SELECT ra.applicant_id, ra.status, r.status as replacement_status
      FROM replacement_applications ra
      JOIN replacements r ON ra.replacement_id = r.id
      WHERE ra.id = ${applicationId}
    `

    if (application.length === 0) {
      return { error: "Candidature non trouvée" }
    }

    const { applicant_id, status, replacement_status } = application[0]

    // Only the applicant can withdraw their own application
    if (applicant_id !== user.id) {
      return { error: "Non autorisé" }
    }

    // Can only withdraw pending applications
    if (status !== "pending") {
      return { error: "Vous ne pouvez retirer que les candidatures en attente" }
    }

    // Can't withdraw if replacement is no longer open
    if (replacement_status !== "open") {
      return { error: "Ce remplacement n'est plus disponible" }
    }

    // Delete the application
    await sql`
      DELETE FROM replacement_applications
      WHERE id = ${applicationId}
    `

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error withdrawing application:", error)

    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many Requests") || errorMessage.includes("Too Many R")) {
      return {
        error: "Trop de requêtes. Veuillez attendre quelques secondes avant de réessayer.",
        isRateLimit: true,
      }
    }

    return { error: "Erreur lors du retrait de la candidature" }
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
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const result = await sql`
      INSERT INTO replacements (leave_id, user_id, shift_date, shift_type, team_id, status, is_partial, start_time, end_time)
      VALUES (NULL, ${userId}, ${shiftDate}, ${shiftType}, ${teamId}, 'open', ${isPartial}, ${startTime || null}, ${endTime || null})
      RETURNING id
    `

    const replacementId = result[0].id

    const firefighters = await sql`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id != ${userId}
        AND np.enable_email = true
    `

    const formattedDate = parseLocalDate(shiftDate).toLocaleDateString("fr-CA")
    const timeInfo = isPartial && startTime && endTime ? ` de ${startTime} à ${endTime}` : ""
    const message = `Un nouveau remplacement${isPartial ? " partiel" : ""} est disponible pour le ${formattedDate} (${shiftType === "day" ? "Jour" : "Nuit"})${timeInfo}.`

    await Promise.all(
      firefighters.map((firefighter) =>
        createNotification(
          firefighter.id,
          "Nouveau remplacement disponible",
          message,
          "replacement_available",
          replacementId,
          "replacement",
        ).catch((error) => {
          console.error(`[v0] Failed to create notification for user ${firefighter.id}:`, error)
          // Continue even if one notification fails
        }),
      ),
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error creating replacement:", error)
    return { error: "Erreur lors de la création du remplacement" }
  }
}

export async function createReplacement(leaveId: number, shiftDate: string, shiftType: string, teamId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      INSERT INTO replacements (leave_id, shift_date, shift_type, team_id, status)
      VALUES (${leaveId}, ${shiftDate}, ${shiftType}, ${teamId}, 'open')
    `
    revalidatePath("/dashboard/replacements")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la création du remplacement" }
  }
}

export async function cancelReplacement(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE replacement_id = ${replacementId} AND status = 'approved'
    `

    await sql`
      UPDATE replacements
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'annulation" }
  }
}

export async function deleteReplacement(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Delete all applications first (foreign key constraint)
    await sql`
      DELETE FROM replacement_applications
      WHERE replacement_id = ${replacementId}
    `

    // Delete the replacement
    await sql`
      DELETE FROM replacements
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error deleting replacement:", error)

    const errorMessage = error?.message || String(error)
    if (errorMessage.includes("Too Many Requests") || errorMessage.includes("Too Many R")) {
      return {
        error: "Trop de requêtes. Veuillez attendre quelques secondes avant de réessayer.",
        isRateLimit: true,
      }
    }

    return { error: "Erreur lors de la suppression" }
  }
}

export async function getReplacementsForShift(shiftDate: string, shiftType: string, teamId: number) {
  try {
    console.log("[v0] getReplacementsForShift called with:", { shiftDate, shiftType, teamId })

    const replacements = await sql`
      SELECT 
        r.id as replacement_id,
        r.user_id,
        r.status as replacement_status,
        r.shift_date,
        r.shift_type,
        r.is_partial,
        r.start_time,
        r.end_time,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ra.id,
              'applicant_id', ra.applicant_id,
              'first_name', u.first_name,
              'last_name', u.last_name,
              'status', ra.status,
              'applied_at', ra.applied_at
            )
            ORDER BY ra.applied_at DESC
          ) FILTER (WHERE ra.id IS NOT NULL),
          '[]'
        ) as applications
      FROM replacements r
      LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id
      LEFT JOIN users u ON ra.applicant_id = u.id
      WHERE r.shift_date = ${shiftDate}
        AND r.shift_type = ${shiftType}
        AND r.team_id = ${teamId}
        AND r.status IN ('open', 'assigned')
      GROUP BY r.id, r.user_id, r.status, r.shift_date, r.shift_type, r.is_partial, r.start_time, r.end_time
    `

    console.log("[v0] getReplacementsForShift returned:", replacements.length, "replacements")
    console.log("[v0] Replacement details:", JSON.stringify(replacements, null, 2))

    return replacements
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("Too Many R") ||
      errorMessage.includes("not valid JSON")
    ) {
      console.error("[v0] getReplacementsForShift: Rate limit hit, returning empty array")
      return []
    }

    console.error("[v0] Error getting replacements for shift:", error)
    return []
  }
}

export async function getScheduledFirefighters(date: string) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const firefighters = await sql`
      SELECT 
        sa.id as assignment_id,
        sa.shift_id,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.role,
        t.name as team_name,
        t.id as team_id,
        t.color as team_color,
        s.shift_type,
        s.start_time,
        s.end_time,
        s.cycle_day
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      JOIN shifts s ON sa.shift_id = s.id
      JOIN teams t ON s.team_id = t.id
      WHERE s.shift_date = ${date}
      ORDER BY s.shift_type, t.name, u.last_name
    `
    return firefighters
  } catch (error) {
    console.error("[v0] Error getting scheduled firefighters:", error)
    return { error: "Erreur lors de la récupération des pompiers" }
  }
}

// Additional function to handle marking a replacement as completed
export async function markReplacementAsCompleted(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      UPDATE replacements
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la marquage comme complété" }
  }
}

// Function for non-admins to request a replacement
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

  try {
    console.log("[v0] requestReplacement called with:", {
      userId: user.id,
      shiftDate,
      shiftType,
      teamId,
      isPartial,
      startTime,
      endTime,
    })

    // Get cycle config to calculate cycle day
    const cycleConfig = await sql`
      SELECT * FROM cycle_config WHERE is_active = true LIMIT 1
    `

    if (cycleConfig.length === 0) {
      return { error: "Configuration du cycle non trouvée" }
    }

    const { start_date, cycle_length_days } = cycleConfig[0]

    // Parse dates as YYYY-MM-DD strings to avoid timezone conversion
    const startDateStr = new Date(start_date).toISOString().split("T")[0]
    const targetDateStr = new Date(shiftDate).toISOString().split("T")[0]

    // Calculate days difference using date strings
    const startParts = startDateStr.split("-").map(Number)
    const targetParts = targetDateStr.split("-").map(Number)

    const startDateObj = new Date(startParts[0], startParts[1] - 1, startParts[2])
    const targetDateObj = new Date(targetParts[0], targetParts[1] - 1, targetParts[2])

    const daysDiff = Math.floor((targetDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
    const cycleDay = (daysDiff % cycle_length_days) + 1

    console.log("[v0] Calculated cycle day:", { cycleDay, daysDiff })

    // Verify user is a member of the team and the team has a shift on this cycle day with matching shift type
    const teamShift = await sql`
      SELECT s.id
      FROM team_members tm
      JOIN shifts s ON tm.team_id = s.team_id
      WHERE tm.user_id = ${user.id}
        AND s.team_id = ${teamId}
        AND s.cycle_day = ${cycleDay}
        AND s.shift_type = ${shiftType}
    `

    console.log("[v0] Team shift verification:", { found: teamShift.length > 0, teamShift })

    if (teamShift.length === 0) {
      return { error: "Vous n'êtes pas assigné à ce quart" }
    }

    const result = await sql`
      INSERT INTO replacements (user_id, shift_date, shift_type, team_id, status, is_partial, start_time, end_time)
      VALUES (${user.id}, ${shiftDate}, ${shiftType}, ${teamId}, 'pending', ${isPartial}, ${startTime || null}, ${endTime || null})
      RETURNING id
    `

    const replacementId = result[0].id

    console.log("[v0] Replacement request created:", { replacementId })

    // Notify admins about the new request
    const admins = await sql`
      SELECT id FROM users WHERE is_admin = true
    `

    const formattedDate = parseLocalDate(shiftDate).toLocaleDateString("fr-CA")
    const timeInfo = isPartial && startTime && endTime ? ` de ${startTime} à ${endTime}` : ""
    const message = `${user.first_name} ${user.last_name} a demandé un remplacement${isPartial ? " partiel" : ""} pour le ${formattedDate} (${shiftType === "day" ? "Jour" : shiftType === "night" ? "Nuit" : "24h"})${timeInfo}.`

    await Promise.all(
      admins.map((admin) =>
        createNotification(
          admin.id,
          "Nouvelle demande de remplacement",
          message,
          "replacement_requested",
          replacementId,
          "replacement",
        ).catch((error) => {
          console.error(`[v0] Failed to create notification for admin ${admin.id}:`, error)
        }),
      ),
    )

    revalidatePath("/dashboard/replacements")
    return { success: true, replacementId }
  } catch (error) {
    console.error("[v0] Error requesting replacement:", error)
    return { error: "Erreur lors de la demande de remplacement" }
  }
}

// Function for admins to approve replacement requests
export async function approveReplacementRequest(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacement = await sql`
      SELECT r.*, u.id as requester_id, u.first_name, u.last_name
      FROM replacements r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ${replacementId} AND r.status = 'pending'
    `

    if (replacement.length === 0) {
      return { error: "Demande non trouvée ou déjà traitée" }
    }

    const { shift_date, shift_type, is_partial, start_time, end_time, requester_id } = replacement[0]

    // Update status to 'open' (approved and available for applications)
    await sql`
      UPDATE replacements
      SET status = 'open', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacementId}
    `

    // Notify the requester
    const formattedDate = parseLocalDate(shift_date).toLocaleDateString("fr-CA")
    const timeInfo = is_partial && start_time && end_time ? ` de ${start_time} à ${end_time}` : ""
    await createNotification(
      requester_id,
      "Demande de remplacement approuvée",
      `Votre demande de remplacement${is_partial ? " partiel" : ""} pour le ${formattedDate} (${shift_type === "day" ? "Jour" : shift_type === "night" ? "Nuit" : "24h"})${timeInfo} a été approuvée.`,
      "replacement_approved",
      replacementId,
      "replacement",
    )

    // Notify all firefighters about the new available replacement
    const firefighters = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id != ${requester_id}
        AND np.enable_email = true
    `

    const message = `Un nouveau remplacement${is_partial ? " partiel" : ""} est disponible pour le ${formattedDate} (${shift_type === "day" ? "Jour" : shift_type === "night" ? "Nuit" : "24h"})${timeInfo}.`

    await Promise.all(
      firefighters.map((firefighter) =>
        createNotification(
          firefighter.id,
          "Nouveau remplacement disponible",
          message,
          "replacement_available",
          replacementId,
          "replacement",
        ).catch((error) => {
          console.error(`[v0] Failed to create notification for user ${firefighter.id}:`, error)
        }),
      ),
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error approving replacement request:", error)
    return { error: "Erreur lors de l'approbation de la demande" }
  }
}

// Function for admins to reject replacement requests
export async function rejectReplacementRequest(replacementId: number, reason?: string) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacement = await sql`
      SELECT r.*, u.id as requester_id
      FROM replacements r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ${replacementId} AND r.status = 'pending'
    `

    if (replacement.length === 0) {
      return { error: "Demande non trouvée ou déjà traitée" }
    }

    const { shift_date, shift_type, is_partial, start_time, endTime, requester_id } = replacement[0]

    // Update status to 'rejected'
    await sql`
      UPDATE replacements
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacementId}
    `

    // Notify the requester
    const formattedDate = parseLocalDate(shift_date).toLocaleDateString("fr-CA")
    const timeInfo = is_partial && start_time && endTime ? ` de ${start_time} à ${endTime}` : ""
    const reasonText = reason ? ` Raison: ${reason}` : ""
    await createNotification(
      requester_id,
      "Demande de remplacement rejetée",
      `Votre demande de remplacement${is_partial ? " partiel" : ""} pour le ${formattedDate} (${shift_type === "day" ? "Jour" : shift_type === "night" ? "Nuit" : "24h"})${timeInfo} a été rejetée.${reasonText}`,
      "replacement_rejected",
      replacementId,
      "replacement",
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error rejecting replacement request:", error)
    return { error: "Erreur lors du rejet de la demande" }
  }
}

// Function to get pending replacement requests for admins
export async function getPendingReplacementRequests() {
  const user = await getSession()
  if (!user?.is_admin) {
    return []
  }

  const requests = await sql`
    SELECT 
      r.*,
      u.first_name,
      u.last_name,
      t.name as team_name,
      t.type as team_type
    FROM replacements r
    JOIN users u ON r.user_id = u.id
    JOIN teams t ON r.team_id = t.id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC
  `
  return requests
}

// Function to get user's own replacement requests
export async function getUserReplacementRequests(userId: number) {
  const requests = await sql`
    SELECT 
      r.*,
      t.name as team_name,
      t.type as team_type
    FROM replacements r
    JOIN teams t ON r.team_id = t.id
    WHERE r.user_id = ${userId} AND r.status IN ('pending', 'rejected')
    ORDER BY r.created_at DESC
  `
  return requests
}

// Function to update replacement assignment
export async function updateReplacementAssignment(replacementId: number, newFirefighterId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Get the replacement details
    const replacement = await sql`
      SELECT r.*, ra.id as old_application_id, ra.applicant_id as old_firefighter_id
      FROM replacements r
      LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
      WHERE r.id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const { shift_date, shift_type, old_application_id, old_firefighter_id } = replacement[0]

    // Check if there's an existing application from the new firefighter
    const existingApplication = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${newFirefighterId}
    `

    if (existingApplication.length > 0) {
      // Approve the existing application
      await sql`
        UPDATE replacement_applications
        SET status = 'approved', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ${existingApplication[0].id}
      `
    } else {
      // Create a new application and approve it
      await sql`
        INSERT INTO replacement_applications (replacement_id, applicant_id, status, reviewed_by, reviewed_at)
        VALUES (${replacementId}, ${newFirefighterId}, 'approved', ${user.id}, CURRENT_TIMESTAMP)
      `
    }

    // Reject the old application if it exists
    if (old_application_id) {
      await sql`
        UPDATE replacement_applications
        SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ${old_application_id}
      `

      // Notify the old firefighter
      const formattedDate = parseLocalDate(shift_date).toLocaleDateString("fr-CA")
      await createNotification(
        old_firefighter_id,
        "Assignation de remplacement modifiée",
        `Votre assignation pour le remplacement du ${formattedDate} a été modifiée.`,
        "application_rejected",
        replacementId,
        "replacement",
      )
    }

    // Notify the new firefighter
    const formattedDate = parseLocalDate(shift_date).toLocaleDateString("fr-CA")
    await createNotification(
      newFirefighterId,
      "Nouveau remplacement assigné",
      `Vous avez été assigné au remplacement du ${formattedDate}.`,
      "application_approved",
      replacementId,
      "replacement",
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating replacement assignment:", error)
    return { error: "Erreur lors de la modification de l'assignation" }
  }
}

// Function to get available firefighters for a replacement
export async function getAvailableFirefighters(replacementId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Get all firefighters who are not the requester
    const firefighters = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        t.name as team_name,
        t.type as team_type,
        ra.status as application_status
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN teams t ON tm.team_id = t.id
      LEFT JOIN replacement_applications ra ON u.id = ra.applicant_id AND ra.replacement_id = ${replacementId}
      WHERE u.id NOT IN (
        SELECT user_id FROM replacements WHERE id = ${replacementId}
      )
      ORDER BY 
        CASE 
          WHEN t.type = 'part_time' AND t.name LIKE '%1%' THEN 1
          WHEN t.type = 'part_time' AND t.name LIKE '%2%' THEN 2
          WHEN t.type = 'part_time' AND t.name LIKE '%3%' THEN 3
          WHEN t.type = 'part_time' AND t.name LIKE '%4%' THEN 4
          WHEN t.type = 'part_time' THEN 5
          WHEN t.type = 'temporary' THEN 6
          WHEN t.type = 'permanent' AND t.name LIKE '%1%' THEN 7
          WHEN t.type = 'permanent' AND t.name LIKE '%2%' THEN 8
          WHEN t.type = 'permanent' AND t.name LIKE '%3%' THEN 9
          WHEN t.type = 'permanent' AND t.name LIKE '%4%' THEN 10
          ELSE 11
        END,
        u.last_name
    `
    return firefighters
  } catch (error) {
    console.error("[v0] Error getting available firefighters:", error)
    return { error: "Erreur lors de la récupération des pompiers" }
  }
}

// Function to create an extra firefighter replacement
export async function createExtraFirefighterReplacement(
  shiftDate: string,
  shiftType: string,
  teamId: number,
  isPartial = false,
  startTime?: string,
  endTime?: string,
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const result = await sql`
      INSERT INTO replacements (user_id, shift_date, shift_type, team_id, status, is_partial, start_time, end_time)
      VALUES (NULL, ${shiftDate}, ${shiftType}, ${teamId}, 'open', ${isPartial}, ${startTime || null}, ${endTime || null})
      RETURNING id
    `

    const replacementId = result[0].id

    const firefighters = await sql`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE np.enable_email = true
    `

    const formattedDate = parseLocalDate(shiftDate).toLocaleDateString("fr-CA")
    const timeInfo = isPartial && startTime && endTime ? ` de ${startTime} à ${endTime}` : ""
    const message = `Un poste de pompier supplémentaire${isPartial ? " partiel" : ""} est disponible pour le ${formattedDate} (${shiftType === "day" ? "Jour" : shiftType === "night" ? "Nuit" : "24h"})${timeInfo}.`

    await Promise.all(
      firefighters.map((firefighter) =>
        createNotification(
          firefighter.id,
          "Poste de pompier supplémentaire disponible",
          message,
          "replacement_available",
          replacementId,
          "replacement",
        ).catch((error) => {
          console.error(`[v0] Failed to create notification for user ${firefighter.id}:`, error)
        }),
      ),
    )

    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")
    return { success: true, replacementId }
  } catch (error) {
    console.error("[v0] Error creating extra firefighter replacement:", error)
    return { error: "Erreur lors de la création de la demande" }
  }
}
