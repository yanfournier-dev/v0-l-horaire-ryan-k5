"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import {
  sendEmail,
  sendBatchEmails,
  getReplacementAvailableEmail,
  getApplicationRejectedEmail,
  getApplicationApprovedEmail,
  getExchangeRequestEmail,
  getExchangeApprovedEmail,
  getExchangeRejectedEmail,
  getExchangeRequestConfirmationEmail,
} from "@/lib/email"
import { parseLocalDate } from "@/lib/date-utils"
// crypto is available globally in Node.js

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
    console.error("[v0] Delete all notifications error:", error)
    return { error: "Erreur lors de la suppression" }
  }
}

export async function deleteAllNotifications() {
  const user = await getSession()
  if (!user) {
    return { error: "Non authentifié" }
  }

  try {
    await sql`
      DELETE FROM notifications
      WHERE user_id = ${user.id}
    `
    revalidatePath("/dashboard/notifications")
    return { success: true }
  } catch (error) {
    console.error("[v0] Delete all notifications error:", error)
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
      console.log("[v0] No user found, skipping email")
      return { success: true }
    }

    const user = userPrefs[0]
    const fullName = `${user.first_name} ${user.last_name}`

    if (user.enable_email === null) {
      console.log("[v0] No notification preferences found - email notifications disabled by default")
      return { success: true }
    }

    console.log("[v0] User email:", user.email)
    console.log("[v0] Email enabled:", user.enable_email)

    const notificationTypeMap: Record<string, string> = {
      replacement_available: "notify_replacement_available",
      replacement_accepted: "notify_replacement_accepted",
      replacement_rejected: "notify_replacement_rejected",
      schedule_change: "notify_schedule_change",
      application_approved: "notify_replacement_accepted",
      application_rejected: "notify_replacement_rejected",
      replacement_approved: "notify_replacement_accepted",
      exchange_request: "notify_exchange_request",
      exchange_approved: "notify_exchange_approved",
      exchange_rejected: "notify_exchange_rejected",
      exchange_request_confirmation: "notify_exchange_request_confirmation",
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
      try {
        await sendEmailNotification(type, user.email, fullName, message, relatedId, userId)
      } catch (emailError) {
        console.error("[v0] Email sending failed but notification created:", emailError)
        await notifyAdminsOfEmailFailure(user.email, type, emailError)
      }
    } else {
      console.log("[v0] Email not sent - enable_email:", user.enable_email, "has email:", !!user.email)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Notification error:", error)
    return { error: "Erreur lors de la création de la notification" }
  }
}

async function notifyAdminsOfEmailFailure(recipientEmail: string, notificationType: string, error: any) {
  try {
    const admins = await sql`
      SELECT id FROM users WHERE role = 'admin'
    `

    const errorMessage = error instanceof Error ? error.message : String(error)
    const typeMap: Record<string, string> = {
      replacement_available: "Remplacement disponible",
      replacement_accepted: "Remplacement accepté",
      replacement_rejected: "Remplacement rejeté",
      application_approved: "Candidature approuvée",
      application_rejected: "Candidature rejetée",
      exchange_request: "Demande d'échange",
      exchange_approved: "Échange approuvé",
      exchange_rejected: "Échange rejeté",
    }

    const notificationTitle = typeMap[notificationType] || notificationType

    for (const admin of admins) {
      await sql`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          ${admin.id}, 
          ${"Échec d'envoi d'email"}, 
          ${"L'email de notification '" + notificationTitle + "' à " + recipientEmail + " a échoué: " + errorMessage},
          ${"system"}
        )
      `
    }
  } catch (notifyError) {
    console.error("[v0] Failed to notify admins of email failure:", notifyError)
  }
}

async function sendEmailNotification(
  type: string,
  email: string,
  name: string,
  message: string,
  relatedId?: number,
  userId?: number,
) {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] Skipping email in preview - notification created in-app only")
    return
  }

  console.log(
    "[v0] sendEmailNotification called - type:",
    type,
    "email:",
    email,
    "relatedId:",
    relatedId,
    "userId:",
    userId,
  )

  let emailContent
  let applyToken: string | undefined

  switch (type) {
    case "replacement_available":
      if (relatedId && userId) {
        console.log("[v0] Fetching replacement details for relatedId:", relatedId)
        const replacement = await sql`
          SELECT 
            r.shift_date, 
            r.shift_type, 
            r.is_partial, 
            r.start_time, 
            r.end_time,
            u.first_name || ' ' || u.last_name as firefighter_to_replace
          FROM replacements r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `
        console.log("[v0] Replacement found:", replacement.length > 0)

        if (replacement.length > 0) {
          const r = replacement[0]
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null

          applyToken = crypto.randomUUID()
          console.log("[v0] Generated applyToken:", applyToken)

          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 7) // Token valid for 7 days
          console.log("[v0] Token expires at:", expiresAt)

          try {
            console.log("[v0] Inserting token into database...")
            await sql`
              INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
              VALUES (${applyToken}, ${relatedId}, ${userId}, ${expiresAt})
              ON CONFLICT (user_id, replacement_id) 
              DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
            `
            console.log("[v0] Token inserted successfully")
          } catch (error) {
            console.error("[v0] Error creating application token:", error)
            applyToken = undefined
          }

          console.log("[v0] Calling getReplacementAvailableEmail with applyToken:", applyToken)
          emailContent = await getReplacementAvailableEmail(
            name,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            r.firefighter_to_replace || "Pompier supplémentaire",
            r.is_partial,
            partialHours,
            applyToken,
          )
        }
      } else {
        console.log("[v0] Missing relatedId or userId - cannot generate token")
      }
      break

    case "replacement_approved":
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
          LEFT JOIN users u ON r.user_id = u.id
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
            r.firefighter_to_replace || "Pompier supplémentaire",
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "replacement_rejected":
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
          LEFT JOIN users u ON r.user_id = u.id
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
            r.firefighter_to_replace || "Pompier supplémentaire",
            r.is_partial,
            partialHours,
          )
        }
      }
      break

    case "exchange_request":
      if (relatedId) {
        console.log("[v0] Fetching exchange details for relatedId:", relatedId)
        const exchange = await sql`
          SELECT 
            se.*,
            requester.first_name || ' ' || requester.last_name as requester_name,
            target.first_name || ' ' || target.last_name as target_name
          FROM shift_exchanges se
          LEFT JOIN users requester ON se.requester_id = requester.id
          LEFT JOIN users target ON se.target_id = target.id
          WHERE se.id = ${relatedId}
        `
        console.log("[v0] Exchange found:", exchange.length > 0)

        if (exchange.length > 0) {
          const ex = exchange[0]
          const requesterPartialHours =
            ex.is_partial && ex.requester_start_time && ex.requester_end_time
              ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
              : null
          const targetPartialHours =
            ex.is_partial && ex.target_start_time && ex.target_end_time
              ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
              : null

          emailContent = await getExchangeRequestEmail(
            ex.target_name,
            ex.requester_name,
            parseLocalDate(ex.requester_shift_date).toLocaleDateString("fr-CA"),
            ex.requester_shift_type,
            parseLocalDate(ex.target_shift_date).toLocaleDateString("fr-CA"),
            ex.target_shift_type,
            ex.is_partial,
            requesterPartialHours,
            targetPartialHours,
          )
        }
      }
      break

    case "exchange_request_confirmation":
      if (relatedId) {
        console.log("[v0] Fetching exchange details for confirmation, relatedId:", relatedId)
        const exchange = await sql`
          SELECT 
            se.*,
            requester.first_name || ' ' || requester.last_name as requester_name,
            target.first_name || ' ' || target.last_name as target_name
          FROM shift_exchanges se
          LEFT JOIN users requester ON se.requester_id = requester.id
          LEFT JOIN users target ON se.target_id = target.id
          WHERE se.id = ${relatedId}
        `
        console.log("[v0] Exchange found for confirmation:", exchange.length > 0)

        if (exchange.length > 0) {
          const ex = exchange[0]
          const requesterPartialHours =
            ex.is_partial && ex.requester_start_time && ex.requester_end_time
              ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
              : null
          const targetPartialHours =
            ex.is_partial && ex.target_start_time && ex.target_end_time
              ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
              : null

          emailContent = await getExchangeRequestConfirmationEmail(
            ex.requester_name,
            ex.target_name,
            parseLocalDate(ex.requester_shift_date).toLocaleDateString("fr-CA"),
            ex.requester_shift_type,
            parseLocalDate(ex.target_shift_date).toLocaleDateString("fr-CA"),
            ex.target_shift_type,
            ex.is_partial,
            requesterPartialHours,
            targetPartialHours,
          )
        }
      }
      break

    case "exchange_approved":
      if (relatedId && userId) {
        console.log("[v0] Fetching exchange details for relatedId:", relatedId, "userId:", userId)
        const exchange = await sql`
          SELECT 
            se.*,
            requester.first_name || ' ' || requester.last_name as requester_name,
            target.first_name || ' ' || target.last_name as target_name
          FROM shift_exchanges se
          LEFT JOIN users requester ON se.requester_id = requester.id
          LEFT JOIN users target ON se.target_id = target.id
          WHERE se.id = ${relatedId}
        `
        console.log("[v0] Exchange found:", exchange.length > 0)

        if (exchange.length > 0) {
          const ex = exchange[0]
          const isRequester = userId === ex.requester_id
          const yourDate = isRequester ? ex.requester_shift_date : ex.target_shift_date
          const yourShiftType = isRequester ? ex.requester_shift_type : ex.target_shift_type
          const otherDate = isRequester ? ex.target_shift_date : ex.requester_shift_date
          const otherShiftType = isRequester ? ex.target_shift_type : ex.requester_shift_type
          const otherName = isRequester ? ex.target_name : ex.requester_name

          const yourPartialHours =
            ex.is_partial && isRequester && ex.requester_start_time && ex.requester_end_time
              ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
              : ex.is_partial && !isRequester && ex.target_start_time && ex.target_end_time
                ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
                : null

          const otherPartialHours =
            ex.is_partial && isRequester && ex.target_start_time && ex.target_end_time
              ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
              : ex.is_partial && !isRequester && ex.requester_start_time && ex.requester_end_time
                ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
                : null

          emailContent = await getExchangeApprovedEmail(
            name,
            otherName,
            parseLocalDate(yourDate).toLocaleDateString("fr-CA"),
            yourShiftType,
            parseLocalDate(otherDate).toLocaleDateString("fr-CA"),
            otherShiftType,
            ex.is_partial,
            yourPartialHours,
            otherPartialHours,
          )
        }
      }
      break

    case "exchange_rejected":
      if (relatedId && userId) {
        console.log("[v0] Fetching exchange details for relatedId:", relatedId, "userId:", userId)
        const exchange = await sql`
          SELECT 
            se.*,
            requester.first_name || ' ' || requester.last_name as requester_name,
            target.first_name || ' ' || target.last_name as target_name
          FROM shift_exchanges se
          LEFT JOIN users requester ON se.requester_id = requester.id
          LEFT JOIN users target ON se.target_id = target.id
          WHERE se.id = ${relatedId}
        `
        console.log("[v0] Exchange found:", exchange.length > 0)

        if (exchange.length > 0) {
          const ex = exchange[0]
          const isRequester = userId === ex.requester_id
          const yourDate = isRequester ? ex.requester_shift_date : ex.target_shift_date
          const yourShiftType = isRequester ? ex.requester_shift_type : ex.target_shift_type
          const otherDate = isRequester ? ex.target_shift_date : ex.requester_shift_date
          const otherShiftType = isRequester ? ex.target_shift_type : ex.requester_shift_type
          const otherName = isRequester ? ex.target_name : ex.requester_name

          const yourPartialHours =
            ex.is_partial && isRequester && ex.requester_start_time && ex.requester_end_time
              ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
              : ex.is_partial && !isRequester && ex.target_start_time && ex.target_end_time
                ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
                : null

          const otherPartialHours =
            ex.is_partial && isRequester && ex.target_start_time && ex.target_end_time
              ? `${ex.target_start_time.substring(0, 5)} - ${ex.target_end_time.substring(0, 5)}`
              : ex.is_partial && !isRequester && ex.requester_start_time && ex.requester_end_time
                ? `${ex.requester_start_time.substring(0, 5)} - ${ex.requester_end_time.substring(0, 5)}`
                : null

          emailContent = await getExchangeRejectedEmail(
            name,
            otherName,
            parseLocalDate(yourDate).toLocaleDateString("fr-CA"),
            yourShiftType,
            parseLocalDate(otherDate).toLocaleDateString("fr-CA"),
            otherShiftType,
            ex.rejected_reason,
            ex.is_partial,
            yourPartialHours,
            otherPartialHours,
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
    if (!result.success) {
      throw new Error(result.error?.message || "Email sending failed")
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
    notify_exchange_request?: boolean
    notify_exchange_approved?: boolean
    notify_exchange_rejected?: boolean
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
          notify_schedule_change,
          notify_exchange_request,
          notify_exchange_approved,
          notify_exchange_rejected
        ) VALUES (
          ${userId},
          ${preferences.enable_app ?? true},
          ${preferences.enable_email ?? false},
          ${preferences.notify_replacement_available ?? false},
          ${preferences.notify_replacement_accepted ?? false},
          ${preferences.notify_replacement_rejected ?? false},
          ${preferences.notify_schedule_change ?? false},
          ${preferences.notify_exchange_request ?? false},
          ${preferences.notify_exchange_approved ?? false},
          ${preferences.notify_exchange_rejected ?? false}
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
          notify_exchange_request = ${preferences.notify_exchange_request ?? existing[0].notify_exchange_request},
          notify_exchange_approved = ${preferences.notify_exchange_approved ?? existing[0].notify_exchange_approved},
          notify_exchange_rejected = ${preferences.notify_exchange_rejected ?? existing[0].notify_exchange_rejected},
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

export async function createBatchNotificationsInApp(
  userIds: number[],
  title: string,
  message: string,
  type: string,
  relatedId: number | null,
  relatedType: string | null,
) {
  if (userIds.length === 0) return

  try {
    console.log(`[v0] Creating ${userIds.length} notifications with sequential inserts`)

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i]

      await sql`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (${userId}, ${title}, ${message}, ${type}, ${relatedId}, ${relatedType})
      `

      if (i < userIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
    }

    console.log(`[v0] Created ${userIds.length} notifications successfully`)
  } catch (error) {
    console.error("[v0] Batch notification creation error:", error)
    throw error
  }
}

export async function createBatchNotifications(
  notifications: Array<{
    userId: number
    title: string
    message: string
    type: string
    relatedId?: number
    relatedType?: string
  }>,
) {
  if (notifications.length === 0) {
    return { success: true }
  }

  try {
    console.log("[v0] Creating batch notifications for", notifications.length, "users")

    // Insert all notifications in a single query
    await createBatchNotificationsInApp(
      notifications.map((n) => n.userId),
      notifications[0].title,
      notifications[0].message,
      notifications[0].type,
      notifications[0].relatedId || null,
      notifications[0].relatedType || null,
    )

    console.log("[v0] Batch notifications created successfully")

    const type = notifications[0]?.type
    const relatedId = notifications[0]?.relatedId

    if (type === "replacement_available" && relatedId) {
      // Send emails in background with delays, don't wait for completion
      ;(async () => {
        for (let i = 0; i < notifications.length; i++) {
          const n = notifications[i]

          // Add delay between emails to avoid rate limiting (except for first one)
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          try {
            const userPrefs = await sql`
              SELECT 
                u.email,
                u.first_name,
                u.last_name,
                np.enable_email,
                np.notify_replacement_available
              FROM users u
              LEFT JOIN notification_preferences np ON u.id = np.user_id
              WHERE u.id = ${n.userId}
            `

            if (userPrefs.length > 0) {
              const user = userPrefs[0]
              const shouldSendEmail =
                user.enable_email === true &&
                (user.notify_replacement_available === true || user.notify_replacement_available === null)

              if (shouldSendEmail && user.email) {
                const fullName = `${user.first_name} ${user.last_name}`
                await sendEmailNotification(type, user.email, fullName, n.message, relatedId, n.userId)
              }
            }
          } catch (error) {
            console.error("[v0] Error sending email to user", n.userId, ":", error)
          }
        }
      })().catch((error) => console.error("[v0] Batch email background process error:", error))
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Batch notification error:", error)
    return { error: "Erreur lors de la création des notifications" }
  }
}

export async function sendBatchReplacementEmails(replacementId: number, firefighterToReplaceName: string) {
  // Only send emails in production
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] Skipping batch emails in preview environment")
    return { success: true, skipped: true }
  }

  try {
    // Get replacement details
    const replacement = await sql`
      SELECT 
        r.shift_date, 
        r.shift_type, 
        r.is_partial, 
        r.start_time, 
        r.end_time
      FROM replacements r
      WHERE r.id = ${replacementId}
    `

    if (replacement.length === 0) {
      console.error("[v0] Replacement not found for batch emails")
      return { success: false, error: "Replacement not found" }
    }

    const r = replacement[0]
    const partialHours =
      r.is_partial && r.start_time && r.end_time
        ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
        : null

    // Get all users who should receive emails
    const eligibleUsers = await sql`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        np.enable_email,
        np.notify_replacement_available
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE (np.enable_email IS NULL OR np.enable_email = true)
        AND (np.notify_replacement_available IS NULL OR np.notify_replacement_available = true)
        AND u.email IS NOT NULL
    `

    console.log("[v0] Found", eligibleUsers.length, "users for batch emails")

    if (eligibleUsers.length === 0) {
      return { success: true, sent: 0 }
    }

    // Generate all email contents
    const emails = await Promise.all(
      eligibleUsers.map(async (user) => {
        const fullName = `${user.first_name} ${user.last_name}`

        // Generate token for this user
        const applyToken = crypto.randomUUID()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        await sql`
          INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
          VALUES (${applyToken}, ${replacementId}, ${user.id}, ${expiresAt})
          ON CONFLICT (user_id, replacement_id) 
          DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
        `

        const emailContent = await getReplacementAvailableEmail(
          fullName,
          parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
          r.shift_type,
          firefighterToReplaceName,
          r.is_partial,
          partialHours,
          applyToken,
        )

        return {
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
        }
      }),
    )

    // Send all emails in one batch request
    const result = await sendBatchEmails(emails)

    if (!result.success) {
      // Notify admins of batch failure
      const admins = await sql`
        SELECT id FROM users WHERE role = 'admin'
      `

      const errorMessage = result.error instanceof Error ? result.error.message : String(result.error)

      for (const admin of admins) {
        await sql`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (
            ${admin.id}, 
            ${"Échec d'envoi d'emails en batch"}, 
            ${"L'envoi en batch de " + emails.length + " emails de notification 'Remplacement disponible' a échoué: " + errorMessage},
            ${"system_error"}
          )
        `
      }
    }

    return result
  } catch (error) {
    console.error("[v0] sendBatchReplacementEmails error:", error)
    return { success: false, error }
  }
}
