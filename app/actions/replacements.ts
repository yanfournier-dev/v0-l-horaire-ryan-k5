"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"

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
      assigned_user.last_name as assigned_last_name
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
    LEFT JOIN users assigned_user ON ra.applicant_id = assigned_user.id
    WHERE r.status IN ('open', 'assigned')
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
      assigned_user.last_name as assigned_last_name
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
    LEFT JOIN users assigned_user ON ra.applicant_id = assigned_user.id
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

export async function applyForReplacement(replacementId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    // Check if already applied
    const existing = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacementId} AND applicant_id = ${user.id}
    `

    if (existing.length > 0) {
      return { error: "Vous avez déjà postulé pour ce remplacement" }
    }

    await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacementId}, ${user.id}, 'pending')
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
      SELECT shift_date, shift_type FROM replacements WHERE id = ${replacement_id}
    `
    const replacement = replacementResult[0]

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

    // Reject all other applications for this replacement
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

    await createNotification(
      applicant_id,
      "Candidature approuvée",
      `Votre candidature pour le remplacement du ${new Date(replacement.shift_date).toLocaleDateString("fr-CA")} a été approuvée.`,
      "application_approved",
      replacement_id,
      "replacement",
    )

    for (const applicant of otherApplicants) {
      await createNotification(
        applicant.applicant_id,
        "Candidature rejetée",
        `Votre candidature pour le remplacement du ${new Date(replacement.shift_date).toLocaleDateString("fr-CA")} a été rejetée.`,
        "application_rejected",
        replacement_id,
        "replacement",
      )
    }

    revalidatePath("/dashboard/replacements")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'approbation" }
  }
}

export async function rejectApplication(applicationId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      UPDATE replacement_applications
      SET status = 'rejected', reviewed_by = ${user.id}, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${applicationId}
    `
    revalidatePath("/dashboard/replacements")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors du rejet" }
  }
}

export async function createReplacementFromShift(userId: number, shiftDate: string, shiftType: string, teamId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      INSERT INTO replacements (leave_id, user_id, shift_date, shift_type, team_id, status)
      VALUES (NULL, ${userId}, ${shiftDate}, ${shiftType}, ${teamId}, 'open')
    `

    // Create notification for the firefighter being replaced
    await createNotification(
      userId,
      "Demande de remplacement",
      `Une demande de remplacement a été créée pour votre quart du ${new Date(shiftDate).toLocaleDateString("fr-CA")}.`,
      "replacement_created",
      null,
      "replacement",
    )

    revalidatePath("/dashboard/replacements")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error creating replacement:", error)
    return { error: "Erreur lors de la création du remplacement" }
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
      UPDATE replacements
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${replacementId}
    `
    revalidatePath("/dashboard/replacements")
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
    return { success: true }
  } catch (error) {
    console.error("[v0] Error deleting replacement:", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function getReplacementsForShift(shiftDate: string, shiftType: string, teamId: number) {
  try {
    const replacements = await sql`
      SELECT 
        r.id as replacement_id,
        r.user_id,
        r.status as replacement_status,
        r.shift_date,
        r.shift_type,
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
      GROUP BY r.id, r.user_id, r.status, r.shift_date, r.shift_type
    `
    return replacements
  } catch (error) {
    console.error("[v0] Error getting replacements for shift:", error)
    return []
  }
}
