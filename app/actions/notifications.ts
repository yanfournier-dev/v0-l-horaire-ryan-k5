"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getUserNotifications(userId: number) {
  const notifications = await sql`
    SELECT * FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return notifications
}

export async function getUnreadCount(userId: number) {
  const result = await sql`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ${userId} AND is_read = false
  `
  return result[0]?.count || 0
}

export async function markAsRead(notificationId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    await sql`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${notificationId} AND user_id = ${user.id}
    `
    revalidatePath("/dashboard/notifications")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la mise à jour" }
  }
}

export async function markAllAsRead() {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    await sql`
      UPDATE notifications
      SET is_read = true
      WHERE user_id = ${user.id} AND is_read = false
    `
    revalidatePath("/dashboard/notifications")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la mise à jour" }
  }
}

export async function deleteNotification(notificationId: number) {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    await sql`
      DELETE FROM notifications
      WHERE id = ${notificationId} AND user_id = ${user.id}
    `
    revalidatePath("/dashboard/notifications")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}

// Helper function to create notifications
export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  relatedId?: number,
  relatedType?: string,
) {
  try {
    await sql`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (${userId}, ${title}, ${message}, ${type}, ${relatedId || null}, ${relatedType || null})
    `
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la création de la notification" }
  }
}
