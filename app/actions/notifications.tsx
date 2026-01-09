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
  // Removed getExchangeRequestEmail, getExchangeApprovedEmail, getExchangeRejectedEmail, getExchangeRequestConfirmationEmail
} from "@/lib/email"
import { parseLocalDate } from "@/lib/date-utils"
import { sendTelegramMessage } from "@/lib/telegram"
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
        np.enable_telegram,
        np.telegram_chat_id,
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
      application_approved: "notify_replacement_accepted",
      application_rejected: "notify_replacement_rejected",
      replacement_approved: "notify_replacement_accepted",
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

    if (user.enable_telegram === true && user.telegram_chat_id) {
      console.log("[v0] Sending Telegram notification to chat_id:", user.telegram_chat_id)
      try {
        await sendTelegramNotificationMessage(type, user.telegram_chat_id, fullName, message, relatedId)
      } catch (telegramError) {
        console.error("[v0] Telegram sending failed but notification created:", telegramError)
      }
    } else {
      console.log(
        "[v0] Telegram not sent - enable_telegram:",
        user.enable_telegram,
        "has chat_id:",
        !!user.telegram_chat_id,
      )
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
      SELECT id FROM users WHERE is_admin = true
    `

    const errorMessage = error instanceof Error ? error.message : String(error)
    const typeMap: Record<string, string> = {
      replacement_available: "Remplacement disponible",
      replacement_accepted: "Remplacement accepté",
      replacement_rejected: "Remplacement rejeté",
      application_approved: "Candidature approuvée",
      application_rejected: "Candidature rejetée",
      // Removed exchange_request, exchange_approved, exchange_rejected
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
    console.error("[v0] PRODUCTION: Failed to notify admins of email failure:", notifyError)
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

    // This notification type is no longer supported
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
    enable_telegram?: boolean
    notify_replacement_available?: boolean
    notify_replacement_accepted?: boolean
    notify_replacement_rejected?: boolean
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
          enable_telegram,
          notify_replacement_available,
          notify_replacement_accepted,
          notify_replacement_rejected
        ) VALUES (
          ${userId},
          ${preferences.enable_app ?? true},
          ${preferences.enable_email ?? false},
          ${preferences.enable_telegram ?? false},
          ${preferences.notify_replacement_available ?? false},
          ${preferences.notify_replacement_accepted ?? false},
          ${preferences.notify_replacement_rejected ?? false}
        )
      `
    } else {
      await sql`
        UPDATE notification_preferences
        SET
          enable_app = ${preferences.enable_app ?? existing[0].enable_app},
          enable_email = ${preferences.enable_email ?? existing[0].enable_email},
          enable_telegram = ${preferences.enable_telegram ?? existing[0].enable_telegram},
          notify_replacement_available = ${preferences.notify_replacement_available ?? existing[0].notify_replacement_available},
          notify_replacement_accepted = ${preferences.notify_replacement_accepted ?? existing[0].notify_replacement_accepted},
          notify_replacement_rejected = ${preferences.notify_replacement_rejected ?? existing[0].notify_replacement_rejected},
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

export async function sendBatchReplacementEmails(
  replacementId: number,
  firefighterToReplaceName: string,
  deadlineLabel: string,
) {
  // Only send emails in production
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] V0 PREVIEW: Skipping batch emails in preview environment")
    return { success: true, skipped: true, sent: 0, failed: 0, recipients: [] }
  }

  console.log("[v0] PRODUCTION: sendBatchReplacementEmails called for replacement", replacementId)

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
      console.error("[v0] PRODUCTION ERROR: Replacement not found for batch emails")
      return { success: false, error: "Replacement not found", sent: 0, failed: 0, recipients: [] }
    }

    const r = replacement[0]
    console.log("[v0] PRODUCTION: Replacement details fetched successfully")

    const partialHours =
      r.is_partial && r.start_time && r.end_time
        ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
        : null

    // Get all users who should receive emails - properly checking notification preferences
    const eligibleUsers = await sql`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        COALESCE(np.enable_email, true) as enable_email,
        COALESCE(np.notify_replacement_available, true) as notify_replacement_available
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.email IS NOT NULL
        AND u.email != ''
    `

    const filteredUsers = eligibleUsers.filter(
      (user: any) => user.enable_email === true && user.notify_replacement_available === true,
    )

    console.log(
      "[v0] PRODUCTION: Found",
      filteredUsers.length,
      "eligible users for batch emails (out of",
      eligibleUsers.length,
      "total users)",
    )

    console.log("[v0] PRODUCTION: Recipient emails:", filteredUsers.map((u: any) => u.email).join(", "))

    if (filteredUsers.length === 0) {
      console.log("[v0] PRODUCTION: No eligible users, skipping emails")
      return { success: true, sent: 0, failed: 0, recipients: [] }
    }

    console.log("[v0] PRODUCTION: Generating email contents...")
    console.log("[v0] PRODUCTION: deadlineLabel parameter:", deadlineLabel)

    // Generate all email contents
    const emails = await Promise.all(
      filteredUsers.map(async (user: any) => {
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

        try {
          console.log("[v0] PRODUCTION: Generating email for user", user.email, "with deadlineLabel:", deadlineLabel)

          const emailContent = await getReplacementAvailableEmail(
            fullName,
            parseLocalDate(r.shift_date).toLocaleDateString("fr-CA"),
            r.shift_type,
            firefighterToReplaceName,
            r.is_partial,
            partialHours,
            applyToken,
            deadlineLabel,
          )

          console.log("[v0] PRODUCTION: Email content generated successfully for", user.email)

          return {
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            userId: user.id,
            name: fullName,
          }
        } catch (emailError) {
          console.error("[v0] PRODUCTION ERROR: Failed to generate email for", user.email, "Error:", emailError)
          throw emailError
        }
      }),
    )

    console.log("[v0] PRODUCTION: Email contents generated, calling sendBatchEmails...")

    const result = await sendBatchEmails(emails)

    console.log("[v0] PRODUCTION: sendBatchEmails returned:", result)

    if (!result.success) {
      console.error("[v0] PRODUCTION ERROR: Batch emails failed, notifying admins...")

      const admins = await sql`
        SELECT id FROM users WHERE is_admin = true
      `

      // Format shift date
      const shiftDateStr = parseLocalDate(r.shift_date).toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      // Translate shift type
      const shiftTypeMap: Record<string, string> = {
        day: "Jour",
        night: "Nuit",
        "24h": "24h",
      }
      const shiftTypeLabel = shiftTypeMap[r.shift_type] || r.shift_type

      // Format partial hours if applicable
      const partialInfo = r.is_partial && partialHours ? ` (${partialHours})` : ""

      // Get list of failed emails from the errors array
      const failedEmails = result.errors?.map((errorItem: any) => {
        // Find the corresponding user by email
        const failedEmail = emails.find((e) => e.to === errorItem.to)
        if (failedEmail) {
          const errorMsg = errorItem.error?.message || errorItem.error || "Erreur inconnue"
          return `${failedEmail.name} (${failedEmail.to}): ${errorMsg}`
        }
        return `${errorItem.to}: ${errorItem.error?.message || errorItem.error || "Erreur inconnue"}`
      })

      const failedEmailsList =
        failedEmails && failedEmails.length > 0 ? failedEmails.join("\n") : "Erreur générale lors de l'envoi"

      const detailedMessage = `Les emails de notification pour le remplacement #${replacementId} ont échoué.\n\nDétails du remplacement:\n• Pompier à remplacer: ${firefighterToReplaceName}\n• Date: ${shiftDateStr}\n• Type de quart: ${shiftTypeLabel}${partialInfo}\n\nEmails échoués (${result.failed}/${emails.length}):\n${failedEmailsList}`

      for (const admin of admins) {
        await sql`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (
            ${admin.id}, 
            ${"Échec d'envoi d'emails"}, 
            ${detailedMessage},
            ${"system"}
          )
        `
      }
    }

    return {
      success: result.success,
      sent: result.sent || 0,
      failed: result.failed || 0,
      recipients: emails.map((email) => {
        // Check if this email is in the errors array
        const hasError = result.errors?.some((e: any) => e.to === email.to)
        const errorItem = result.errors?.find((e: any) => e.to === email.to)

        return {
          userId: email.userId,
          name: email.name,
          email: email.to,
          success: !hasError,
          error: errorItem?.error?.message || errorItem?.error,
        }
      }),
    }
  } catch (error) {
    console.error("[v0] PRODUCTION: sendBatchReplacementEmails error:", error)
    if (error instanceof Error) {
      console.error("[v0] PRODUCTION ERROR STACK:", error.stack)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      sent: 0,
      failed: 0,
      recipients: [],
    }
  }
}

async function sendTelegramNotificationMessage(
  type: string,
  chatId: string,
  name: string,
  message: string,
  relatedId?: number,
) {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] Skipping Telegram in preview - notification created in-app only")
    return
  }

  console.log("[v0] sendTelegramNotificationMessage called - type:", type, "chatId:", chatId)

  let telegramMessage = ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://v0-l-horaire-ryan.vercel.app"

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
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.id = ${relatedId}
        `

        if (replacement.length > 0) {
          const r = replacement[0]
          const date = parseLocalDate(r.shift_date).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })

          const shiftTypeLabel = r.shift_type === "jour" ? "Jour (7h-17h)" : "Nuit (17h-7h)"
          const partialInfo =
            r.is_partial && r.start_time && r.end_time
              ? `\n⏰ Heures: ${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : ""

          telegramMessage = `🚒 <b>Nouveau remplacement disponible</b>

📅 Date: ${date}
🕐 Quart: ${shiftTypeLabel}${partialInfo}
👤 Remplace: ${r.firefighter_to_replace || "Pompier supplémentaire"}

<a href="${appUrl}/dashboard/replacements/${relatedId}">Voir les détails et postuler</a>`
        }
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
          const date = parseLocalDate(r.shift_date).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })

          const shiftTypeLabel = r.shift_type === "jour" ? "Jour (7h-17h)" : "Nuit (17h-7h)"
          const partialInfo =
            r.is_partial && r.start_time && r.end_time
              ? `\n⏰ Heures: ${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : ""

          telegramMessage = `✅ <b>Candidature acceptée</b>

Félicitations! Votre candidature a été acceptée.

📅 Date: ${date}
🕐 Quart: ${shiftTypeLabel}${partialInfo}
👤 Remplace: ${r.firefighter_to_replace || "Pompier supplémentaire"}

<a href="${appUrl}/dashboard/replacements/${relatedId}">Voir les détails</a>`
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
          const date = parseLocalDate(r.shift_date).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })

          const shiftTypeLabel = r.shift_type === "jour" ? "Jour (7h-17h)" : "Nuit (17h-7h)"
          const partialInfo =
            r.is_partial && r.start_time && r.end_time
              ? `\n⏰ Heures: ${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : ""

          telegramMessage = `❌ <b>Candidature refusée</b>

Votre candidature pour ce remplacement a été refusée.

📅 Date: ${date}
🕐 Quart: ${shiftTypeLabel}${partialInfo}
👤 Remplace: ${r.firefighter_to_replace || "Pompier supplémentaire"}

<a href="${appUrl}/dashboard/replacements">Voir d'autres remplacements disponibles</a>`
        }
      }
      break
  }

  if (telegramMessage) {
    console.log("[v0] Sending Telegram message...")
    const result = await sendTelegramMessage(chatId, telegramMessage)
    console.log("[v0] Telegram message result:", result)

    if (!result.success) {
      throw new Error(result.error || "Telegram sending failed")
    }
  } else {
    console.log("[v0] No Telegram message generated for type:", type)
  }
}
