"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  sendEmail,
  getReplacementAvailableEmail,
  getApplicationRejectedEmail,
  getApplicationApprovedEmail,
} from "@/lib/email"
import { parseLocalDate } from "@/lib/date-utils"

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

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  relatedId?: number,
  relatedType?: string,
) {
  try {
    console.log("[v0] Creating notification for user:", userId, "type:", type)

    // Create in-app notification
    await sql`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (${userId}, ${title}, ${message}, ${type}, ${relatedId || null}, ${relatedType || null})
    `

    // Get user preferences and contact info
    const userPrefs = await sql`
      SELECT 
        u.email,
        u.first_name,
        u.last_name,
        np.enable_email,
        np.notify_replacement_available,
        np.notify_replacement_accepted,
        np.notify_replacement_rejected,
        np.notify_schedule_change
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id = ${userId}
    `

    console.log("[v0] User preferences found:", userPrefs.length > 0)

    if (userPrefs.length === 0) {
      console.log("[v0] No user preferences found, skipping email")
      return { success: true }
    }

    const user = userPrefs[0]
    const fullName = `${user.first_name} ${user.last_name}`

    console.log("[v0] User email:", user.email)
    console.log("[v0] Email enabled:", user.enable_email)

    const notificationTypeMap: Record<string, string> = {
      replacement_available: "notify_replacement_available",
      replacement_accepted: "notify_replacement_accepted",
      replacement_rejected: "notify_replacement_rejected",
      schedule_change: "notify_schedule_change",
      application_approved: "notify_replacement_accepted",
      application_rejected: "notify_replacement_rejected",
    }

    const prefKey = notificationTypeMap[type]
    console.log("[v0] Notification type preference key:", prefKey)
    console.log("[v0] Preference value:", user[prefKey])

    if (prefKey && user[prefKey] === false) {
      console.log("[v0] User disabled this notification type, skipping email")
      return { success: true }
    }

    if (user.enable_email === true && user.email) {
      console.log("[v0] Sending email notification to:", user.email)
      await sendEmailNotification(type, user.email, fullName, message, relatedId)
    } else {
      console.log("[v0] Email not sent - enable_email:", user.enable_email, "has email:", !!user.email)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Notification error:", error)
    return { error: "Erreur lors de la création de la notification" }
  }
}

async function sendEmailNotification(type: string, email: string, name: string, message: string, relatedId?: number) {
  console.log("[v0] sendEmailNotification called - type:", type, "email:", email, "relatedId:", relatedId)

  let emailContent

  switch (type) {
    case "replacement_available":
      if (relatedId) {
        const replacement = await sql`
          SELECT 
            r.shift_date, 
            r.shift_type, 
            r.is_partial, 
            r.start_time, 
            r.end_time,
            u.first_name || ' ' || u.last_name as firefighter_to_replace
          FROM replacements r
          JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null
          emailContent = await getReplacementAvailableEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.firefighter_to_replace,
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "application_approved":
      if (relatedId) {
        const replacement = await sql`
          SELECT 
            r.shift_date, 
            r.shift_type, 
            r.is_partial, 
            r.start_time, 
            r.end_time,
            u.first_name || ' ' || u.last_name as firefighter_to_replace
          FROM replacements r
          JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null
          emailContent = await getApplicationApprovedEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.firefighter_to_replace,
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "application_rejected":
      if (relatedId) {
        const replacement = await sql`
          SELECT 
            r.shift_date, 
            r.shift_type, 
            r.is_partial, 
            r.start_time, 
            r.end_time,
            u.first_name || ' ' || u.last_name as firefighter_to_replace
          FROM replacements r
          JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null
          emailContent = await getApplicationRejectedEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.firefighter_to_replace,
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "replacement_rejected":
      if (relatedId) {
        const replacement = await sql`
          SELECT 
            r.shift_date, 
            r.shift_type, 
            r.is_partial, 
            r.start_time, 
            r.end_time,
            u.first_name || ' ' || u.last_name as firefighter_to_replace
          FROM replacements r
          JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null
          emailContent = await getApplicationRejectedEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.firefighter_to_replace,
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "schedule_change":
      // Schedule change notifications don't need specific email templates
      // The message is already descriptive enough
      break
  }

  if (emailContent) {
    console.log("[v0] Calling sendEmail with subject:", emailContent.subject)
    try {
      const result = await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      })
      if (result.isTestModeRestriction) {
        console.log("[v0] Email skipped due to Resend test mode - notification still created in database")
      } else {
        console.log("[v0] sendEmail result:", result)
      }
    } catch (error) {
      console.error("[v0] sendEmail error:", error)
    }
  } else {
    console.log("[v0] No email content generated for type:", type)
  }
}

export async function getUserPreferences(userId: number) {
  const prefs = await sql`
    SELECT * FROM notification_preferences
    WHERE user_id = ${userId}
  `
  return prefs[0] || null
}

export async function updateUserPreferences(
  userId: number,
  preferences: {
    enable_app?: boolean
    enable_email?: boolean
    notify_replacement_available?: boolean
    notify_replacement_accepted?: boolean
    notify_replacement_rejected?: boolean
    notify_schedule_change?: boolean
  },
) {
  const user = await getSession()
  if (!user || user.id !== userId) {
    return { error: "Non autorisé" }
  }

  try {
    // Check if preferences already exist
    const existing = await sql`
      SELECT * FROM notification_preferences
      WHERE user_id = ${userId}
    `

    if (existing.length === 0) {
      await sql`
        INSERT INTO notification_preferences (
          user_id,
          enable_app,
          enable_email,
          notify_replacement_available,
          notify_replacement_accepted,
          notify_replacement_rejected,
          notify_schedule_change
        ) VALUES (
          ${userId},
          ${preferences.enable_app ?? true},
          ${preferences.enable_email ?? true},
          ${preferences.notify_replacement_available ?? true},
          ${preferences.notify_replacement_accepted ?? true},
          ${preferences.notify_replacement_rejected ?? true},
          ${preferences.notify_schedule_change ?? true}
        )
      `
    } else {
      await sql`
        UPDATE notification_preferences
        SET
          enable_app = ${preferences.enable_app ?? existing[0].enable_app},
          enable_email = ${preferences.enable_email ?? existing[0].enable_email},
          notify_replacement_available = ${preferences.notify_replacement_available ?? existing[0].notify_replacement_available},
          notify_replacement_accepted = ${preferences.notify_replacement_accepted ?? existing[0].notify_replacement_accepted},
          notify_replacement_rejected = ${preferences.notify_replacement_rejected ?? existing[0].notify_replacement_rejected},
          notify_schedule_change = ${preferences.notify_schedule_change ?? existing[0].notify_schedule_change},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId}
      `
    }

    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (error) {
    console.error("[v0] Update preferences error:", error)
    return { error: "Erreur lors de la mise à jour des préférences" }
  }
}
