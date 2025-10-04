"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"
import { parseLocalDate } from "@/lib/date-utils"

export async function createLeaveRequest(formData: FormData) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string
  const leaveType = formData.get("leaveType") as string
  const reason = formData.get("reason") as string
  const startTime = formData.get("startTime") as string
  const endTime = formData.get("endTime") as string

  if (!startDate || !endDate || !leaveType) {
    return { error: "Tous les champs sont requis" }
  }

  try {
    await sql`
      INSERT INTO leaves (user_id, start_date, end_date, leave_type, reason, status, start_time, end_time)
      VALUES (
        ${user.id}, 
        ${startDate}, 
        ${endDate}, 
        ${leaveType}, 
        ${reason || null}, 
        'pending',
        ${startTime || null},
        ${endTime || null}
      )
    `
    revalidatePath("/dashboard/leaves")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la création de la demande" }
  }
}

export async function getUserLeaves(userId: number) {
  const leaves = await sql`
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
    ORDER BY l.created_at DESC
  `
  return leaves
}

export async function getAllLeaves() {
  const leaves = await sql`
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
      l.created_at DESC
  `
  return leaves
}

export async function approveLeave(leaveId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const leaveResult = await sql`
      SELECT user_id, start_date, end_date FROM leaves WHERE id = ${leaveId}
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

    await createNotification(
      leave.user_id,
      "Demande d'absence approuvée",
      `Votre demande d'absence du ${parseLocalDate(leave.start_date).toLocaleDateString("fr-CA")} au ${parseLocalDate(leave.end_date).toLocaleDateString("fr-CA")} a été approuvée.`,
      "leave_approved",
      leaveId,
      "leave",
    )

    revalidatePath("/dashboard/leaves")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'approbation" }
  }
}

export async function rejectLeave(leaveId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const leaveResult = await sql`
      SELECT user_id, start_date, end_date FROM leaves WHERE id = ${leaveId}
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

    await createNotification(
      leave.user_id,
      "Demande d'absence rejetée",
      `Votre demande d'absence du ${parseLocalDate(leave.start_date).toLocaleDateString("fr-CA")} au ${parseLocalDate(leave.end_date).toLocaleDateString("fr-CA")} a été rejetée.`,
      "leave_rejected",
      leaveId,
      "leave",
    )

    revalidatePath("/dashboard/leaves")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors du rejet" }
  }
}

export async function deleteLeave(leaveId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  // Check if user owns this leave or is admin
  const leave = await sql`
    SELECT user_id FROM leaves WHERE id = ${leaveId}
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
    revalidatePath("/dashboard/leaves")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}
