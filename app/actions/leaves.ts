"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { parseLocalDate } from "@/lib/date-utils"
import { sendEmail } from "@/lib/email"

async function checkOverlappingLeaves(userId: number, startDate: string, endDate: string, excludeLeaveId?: number) {
  const query = excludeLeaveId
    ? sql`
      SELECT COUNT(*) as count
      FROM leaves
      WHERE user_id = ${userId}
        AND id != ${excludeLeaveId}
        AND status IN ('pending', 'approved')
        AND (
          (start_date <= ${endDate} AND end_date >= ${startDate})
        )
    `
    : sql`
      SELECT COUNT(*) as count
      FROM leaves
      WHERE user_id = ${userId}
        AND status IN ('pending', 'approved')
        AND (
          (start_date <= ${endDate} AND end_date >= ${startDate})
        )
    `

  const result = await query
  return Number(result[0]?.count || 0) > 0
}

async function notifyAdminsOfNewLeave(
  leaveId: number,
  userName: string,
  startDate: string,
  endDate: string,
  userId: number,
) {
  try {
    const admins = await sql`
      SELECT id FROM users WHERE is_admin = true
    `

    for (const admin of admins) {
      await createNotification(
        admin.id,
        "Nouvelle demande d'absence",
        `${userName} a demandé une absence du ${parseLocalDate(startDate).toLocaleDateString("fr-CA")} au ${parseLocalDate(endDate).toLocaleDateString("fr-CA")}.`,
        "leave_requested",
        leaveId,
        "leave",
        userId, // Track who requested the leave
      )
    }
  } catch (error) {
    console.error("Error notifying admins:", error)
  }
}

export async function createLeaveRequest(formData: FormData) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  const userId = formData.get("userId") as string
  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string
  const reason = formData.get("reason") as string

  const targetUserId = user.is_admin && userId ? Number.parseInt(userId) : user.id

  if (!startDate || !endDate) {
    return { error: "Les dates sont requises" }
  }

  const hasOverlap = await checkOverlappingLeaves(targetUserId, startDate, endDate)
  if (hasOverlap) {
    return { error: "Cette absence chevauche une absence existante pour ce pompier" }
  }

  try {
    const status = user.is_admin ? "approved" : "pending"

    const result = user.is_admin
      ? await sql`
          INSERT INTO leaves (user_id, start_date, end_date, leave_type, reason, status, approved_by, approved_at)
          VALUES (
            ${targetUserId}, 
            ${startDate}, 
            ${endDate}, 
            'full',
            ${reason || null}, 
            ${status},
            ${user.id},
            CURRENT_TIMESTAMP
          )
          RETURNING id
        `
      : await sql`
          INSERT INTO leaves (user_id, start_date, end_date, leave_type, reason, status)
          VALUES (
            ${targetUserId}, 
            ${startDate}, 
            ${endDate}, 
            'full',
            ${reason || null}, 
            ${status}
          )
          RETURNING id
        `

    const leaveId = result[0].id

    if (!user.is_admin) {
      const userName = `${user.first_name} ${user.last_name}`
      await notifyAdminsOfNewLeave(leaveId, userName, startDate, endDate, user.id)
    }

    revalidatePath("/dashboard/absences")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error creating leave:", error)
    return { error: "Erreur lors de la création de la demande" }
  }
}

export async function getUserLeaves(userId: number, includeFinished = false) {
  const leaves = includeFinished
    ? await sql`
        SELECT 
          l.*,
          u.first_name,
          u.last_name,
          approver.first_name as approver_first_name,
          approver.last_name as approver_last_name
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users approver ON l.approved_by = approver.id
        WHERE l.user_id = ${userId}
        ORDER BY l.start_date DESC, l.created_at DESC
      `
    : await sql`
        SELECT 
          l.*,
          u.first_name,
          u.last_name,
          approver.first_name as approver_first_name,
          approver.last_name as approver_last_name
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users approver ON l.approved_by = approver.id
        WHERE l.user_id = ${userId}
          AND l.end_date >= CURRENT_DATE
        ORDER BY l.start_date DESC, l.created_at DESC
      `
  return leaves
}

export async function getAllLeaves(includeFinished = false) {
  const leaves = includeFinished
    ? await sql`
        SELECT 
          l.*,
          u.first_name,
          u.last_name,
          u.email,
          approver.first_name as approver_first_name,
          approver.last_name as approver_last_name
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users approver ON l.approved_by = approver.id
        ORDER BY 
          CASE l.status 
            WHEN 'pending' THEN 1 
            WHEN 'approved' THEN 2 
            WHEN 'rejected' THEN 3 
          END,
          l.start_date DESC,
          l.created_at DESC
      `
    : await sql`
        SELECT 
          l.*,
          u.first_name,
          u.last_name,
          u.email,
          approver.first_name as approver_first_name,
          approver.last_name as approver_last_name
        FROM leaves l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users approver ON l.approved_by = approver.id
        WHERE l.end_date >= CURRENT_DATE
        ORDER BY 
          CASE l.status 
            WHEN 'pending' THEN 1 
            WHEN 'approved' THEN 2 
            WHEN 'rejected' THEN 3 
          END,
          l.start_date DESC,
          l.created_at DESC
      `
  return leaves
}

export async function getPendingLeavesCount() {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return 0
    }

    const result = await sql`
      SELECT COUNT(*) as count
      FROM leaves
      WHERE status = 'pending'
    `

    return Number(result[0]?.count || 0)
  } catch (error) {
    console.error("getPendingLeavesCount: Error", error)
    return 0
  }
}

export async function checkFirefighterAbsence(userId: number, date: string) {
  try {
    const result = await sql`
      SELECT id, start_date, end_date, reason
      FROM leaves
      WHERE user_id = ${userId}
        AND status = 'approved'
        AND start_date <= ${date}
        AND end_date >= ${date}
      LIMIT 1
    `

    if (result.length > 0) {
      return {
        isAbsent: true,
        absence: result[0],
      }
    }

    return { isAbsent: false }
  } catch (error) {
    console.error("checkFirefighterAbsence: Error", error)
    return { isAbsent: false }
  }
}

export async function approveLeave(leaveId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const leaveResult = await sql`
      SELECT l.user_id, l.start_date, l.end_date, u.first_name, u.last_name, u.email
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ${leaveId}
    `

    if (leaveResult.length === 0) {
      return { error: "Demande non trouvée" }
    }

    const leave = leaveResult[0]

    await sql`
      UPDATE leaves
      SET status = 'approved', approved_by = ${user.id}, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leaveId}
    `

    const startDateFormatted = parseLocalDate(leave.start_date).toLocaleDateString("fr-CA")
    const endDateFormatted = parseLocalDate(leave.end_date).toLocaleDateString("fr-CA")

    await createNotification(
      leave.user_id,
      "Demande d'absence approuvée",
      `Votre demande d'absence du ${startDateFormatted} au ${endDateFormatted} a été approuvée.`,
      "leave_approved",
      leaveId,
      "leave",
      user.id, // Track who approved the leave
    )

    try {
      await sendEmail({
        to: leave.email,
        templateType: "leave_approved",
        variables: {
          name: `${leave.first_name} ${leave.last_name}`,
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        },
      })
    } catch (emailError) {
      console.error("Error sending approval email:", emailError)
    }

    revalidatePath("/dashboard/absences")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error approving leave:", error)
    return { error: "Erreur lors de l'approbation" }
  }
}

export async function rejectLeave(leaveId: number, rejectionReason?: string) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const leaveResult = await sql`
      SELECT l.user_id, l.start_date, l.end_date, u.first_name, u.last_name, u.email
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ${leaveId}
    `

    if (leaveResult.length === 0) {
      return { error: "Demande non trouvée" }
    }

    const leave = leaveResult[0]

    await sql`
      UPDATE leaves
      SET status = 'rejected', approved_by = ${user.id}, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leaveId}
    `

    const startDateFormatted = parseLocalDate(leave.start_date).toLocaleDateString("fr-CA")
    const endDateFormatted = parseLocalDate(leave.end_date).toLocaleDateString("fr-CA")

    await createNotification(
      leave.user_id,
      "Demande d'absence rejetée",
      `Votre demande d'absence du ${startDateFormatted} au ${endDateFormatted} a été rejetée.`,
      "leave_rejected",
      leaveId,
      "leave",
      user.id, // Track who rejected the leave
    )

    try {
      await sendEmail({
        to: leave.email,
        templateType: "leave_rejected",
        variables: {
          name: `${leave.first_name} ${leave.last_name}`,
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          reason: rejectionReason || "",
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        },
      })
    } catch (emailError) {
      console.error("Error sending rejection email:", emailError)
    }

    revalidatePath("/dashboard/absences")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error rejecting leave:", error)
    return { error: "Erreur lors du rejet" }
  }
}

export async function deleteLeave(leaveId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  const leave = await sql`
    SELECT user_id, status FROM leaves WHERE id = ${leaveId}
  `

  if (leave.length === 0) {
    return { error: "Demande non trouvée" }
  }

  if (leave[0].user_id !== user.id && !user.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      DELETE FROM leaves WHERE id = ${leaveId}
    `
    revalidatePath("/dashboard/absences")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting leave:", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function updateLeave(leaveId: number, startDate: string, endDate: string, reason: string) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  const leaveResult = await sql`
    SELECT user_id, status FROM leaves WHERE id = ${leaveId}
  `

  if (leaveResult.length === 0) {
    return { error: "Demande non trouvée" }
  }

  const leave = leaveResult[0]

  if (leave.user_id !== user.id && !user.is_admin) {
    return { error: "Non autorisé" }
  }

  if (!user.is_admin && leave.status !== "pending") {
    return { error: "Seules les absences en attente peuvent être modifiées" }
  }

  const hasOverlap = await checkOverlappingLeaves(leave.user_id, startDate, endDate, leaveId)
  if (hasOverlap) {
    return { error: "Cette absence chevauche une absence existante" }
  }

  try {
    await sql`
      UPDATE leaves
      SET 
        start_date = ${startDate},
        end_date = ${endDate},
        reason = ${reason || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leaveId}
    `
    revalidatePath("/dashboard/absences")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating leave:", error)
    return { error: "Erreur lors de la modification" }
  }
}
