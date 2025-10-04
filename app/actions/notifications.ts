"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  sendEmail,
  getReplacementAvailableEmail,
  getReplacementAcceptedEmail,
  getLeaveApprovedEmail,
  getLeaveRejectedEmail,
  getApplicationApprovedEmail, // Adding import for new email template
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
        np.notify_leave_approved,
        np.notify_leave_rejected,
        np.notify_schedule_change,
        np.notify_shift_reminder
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

    // Check if user wants this type of notification
    const notificationTypeMap: Record<string, string> = {
      replacement_available: "notify_replacement_available",
      replacement_accepted: "notify_replacement_accepted",
      replacement_rejected: "notify_replacement_rejected",
      leave_approved: "notify_leave_approved",
      leave_rejected: "notify_leave_rejected",
      schedule_change: "notify_schedule_change",
      shift_reminder: "notify_shift_reminder",
      application_approved: "notify_application_approved", // Adding new notification type mapping
    }

    const prefKey = notificationTypeMap[type]
    console.log("[v0] Notification type preference key:", prefKey)
    console.log("[v0] Preference value:", user[prefKey])

    if (prefKey && user[prefKey] === false) {
      console.log("[v0] User disabled this notification type, skipping email")
      return { success: true } // User disabled this notification type
    }

    // Send email if enabled
    if (user.enable_email && user.email) {
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
      // Fetch replacement details
      if (relatedId) {
        const replacement = await sql`
          SELECT r.shift_date, r.shift_type, t.name as team_name
          FROM replacements r
          JOIN teams t ON r.team_id = t.id
          WHERE r.id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          emailContent = getReplacementAvailableEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.team_name,
          )
        }
      }
      break

    case "replacement_accepted":
      if (relatedId) {
        const replacement = await sql`
          SELECT shift_date, shift_type
          FROM replacements
          WHERE id = ${relatedId}
        `
        if (replacement.length > 0) {
          const r = replacement[0]
          emailContent = getReplacementAcceptedEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
          )
        }
      }
      break

    case "leave_approved":
      console.log("[v0] Processing leave_approved email")
      if (relatedId) {
        const leave = await sql`
          SELECT start_date, end_date
          FROM leaves
          WHERE id = ${relatedId}
        `
        console.log("[v0] Leave data found:", leave.length > 0)
        if (leave.length > 0) {
          const l = leave[0]
          emailContent = getLeaveApprovedEmail(
            name,
            parseLocalDate(l.start_date).toLocaleDateString("fr-CA"),
            parseLocalDate(l.end_date).toLocaleDateString("fr-CA"),
          )
          console.log("[v0] Email content generated for leave_approved")
        }
      }
      break

    case "leave_rejected":
      console.log("[v0] Processing leave_rejected email")
      if (relatedId) {
        const leave = await sql`
          SELECT start_date, end_date, reason
          FROM leaves
          WHERE id = ${relatedId}
        `
        console.log("[v0] Leave data found:", leave.length > 0)
        if (leave.length > 0) {
          const l = leave[0]
          emailContent = getLeaveRejectedEmail(
            name,
            parseLocalDate(l.start_date).toLocaleDateString("fr-CA"),
            parseLocalDate(l.end_date).toLocaleDateString("fr-CA"),
            l.reason,
          )
          console.log("[v0] Email content generated for leave_rejected")
        }
      }
      break

    case "application_approved":
      console.log("[v0] Processing application_approved email")
      if (relatedId) {
        const replacement = await sql`
          SELECT r.shift_date, r.shift_type, t.name as team_name
          FROM replacements r
          JOIN teams t ON r.team_id = t.id
          WHERE r.id = ${relatedId}
        `
        console.log("[v0] Replacement data found:", replacement.length > 0)
        if (replacement.length > 0) {
          const r = replacement[0]
          emailContent = getApplicationApprovedEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.team_name,
          )
          console.log("[v0] Email content generated for application_approved")
        }
      }
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
      console.log("[v0] sendEmail result:", result)
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
    notify_leave_approved?: boolean
    notify_leave_rejected?: boolean
    notify_schedule_change?: boolean
    notify_shift_reminder?: boolean
    notify_application_approved?: boolean // Adding new preference field
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
      // Insert new preferences with defaults
      await sql`
        INSERT INTO notification_preferences (
          user_id,
          enable_app,
          enable_email,
          notify_replacement_available,
          notify_replacement_accepted,
          notify_replacement_rejected,
          notify_leave_approved,
          notify_leave_rejected,
          notify_schedule_change,
          notify_shift_reminder,
          notify_application_approved // Adding new preference field in insert
        ) VALUES (
          ${userId},
          ${preferences.enable_app ?? true},
          ${preferences.enable_email ?? true},
          ${preferences.notify_replacement_available ?? true},
          ${preferences.notify_replacement_accepted ?? true},
          ${preferences.notify_replacement_rejected ?? true},
          ${preferences.notify_leave_approved ?? true},
          ${preferences.notify_leave_rejected ?? true},
          ${preferences.notify_schedule_change ?? true},
          ${preferences.notify_shift_reminder ?? true},
          ${preferences.notify_application_approved ?? true} // Adding new preference field in insert
        )
      `
    } else {
      // Update existing preferences
      await sql`
        UPDATE notification_preferences
        SET
          enable_app = ${preferences.enable_app ?? existing[0].enable_app},
          enable_email = ${preferences.enable_email ?? existing[0].enable_email},
          notify_replacement_available = ${preferences.notify_replacement_available ?? existing[0].notify_replacement_available},
          notify_replacement_accepted = ${preferences.notify_replacement_accepted ?? existing[0].notify_replacement_accepted},
          notify_replacement_rejected = ${preferences.notify_replacement_rejected ?? existing[0].notify_replacement_rejected},
          notify_leave_approved = ${preferences.notify_leave_approved ?? existing[0].notify_leave_approved},
          notify_leave_rejected = ${preferences.notify_leave_rejected ?? existing[0].notify_leave_rejected},
          notify_schedule_change = ${preferences.notify_schedule_change ?? existing[0].notify_schedule_change},
          notify_shift_reminder = ${preferences.notify_shift_reminder ?? existing[0].notify_shift_reminder},
          notify_application_approved = ${preferences.notify_application_approved ?? existing[0].notify_application_approved}, // Adding new preference field in update
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
