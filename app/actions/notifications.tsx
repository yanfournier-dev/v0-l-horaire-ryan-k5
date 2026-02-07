"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
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
  sentBy?: number,
) {
  try {
    console.log("[v0] createNotification called:", { userId, title, type, relatedId, relatedType })

    const channelsSent: string[] = ["in_app"]
    const channelsFailed: string[] = []
    let deliveryStatus = "success"
    let errorMessage: string | null = null

    // Create in-app notification
    await sql`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type, sent_by)
      VALUES (${userId}, ${title}, ${message}, ${type}, ${relatedId || null}, ${relatedType || null}, ${sentBy || null})
    `

    const notificationResult = await sql`
      SELECT id FROM notifications 
      WHERE user_id = ${userId} 
      AND type = ${type}
      AND created_at >= NOW() - INTERVAL '5 seconds'
      ORDER BY created_at DESC 
      LIMIT 1
    `
    const notificationId = notificationResult[0]?.id

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
        np.notify_schedule_change,
        u.telegram_required
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id = ${userId}
    `

    if (userPrefs.length === 0) {
      deliveryStatus = "skipped"
      errorMessage = "User not found"
      if (notificationId) {
        await sql`
          UPDATE notifications 
          SET delivery_status = ${deliveryStatus},
              channels_sent = ${channelsSent},
              channels_failed = ${channelsFailed},
              error_message = ${errorMessage}
          WHERE id = ${notificationId}
        `
      }
      return { success: true }
    }

    const user = userPrefs[0]
    const fullName = `${user.first_name} ${user.last_name}`

    console.log("[v0] User Telegram preferences:", {
      enable_telegram: user.enable_telegram,
      telegram_chat_id: user.telegram_chat_id,
      type: type,
    })

    if (user.enable_telegram === true && user.telegram_chat_id) {
      console.log("[v0] Attempting to send Telegram notification...")
      try {
        // Generate apply token for replacement_available notifications
        let applyToken: string | undefined
        if (type === "replacement_available" && relatedId) {
          applyToken = crypto.randomUUID()
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          console.log("[v0] Creating token for Telegram - replacement_id:", relatedId, "user_id:", userId, "token:", applyToken)

          try {
            await sql`
              INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
              VALUES (${applyToken}, ${relatedId}, ${userId}, ${expiresAt})
              ON CONFLICT (user_id, replacement_id) 
              DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
            `
            console.log("[v0] Token created successfully for Telegram")
          } catch (error) {
            console.error("[v0] Error creating application token for Telegram:", error)
            applyToken = undefined
          }
        } else {
          console.log("[v0] Token generation skipped - type:", type, "relatedId:", relatedId)
        }

        await sendTelegramNotificationMessage(type, user.telegram_chat_id, fullName, message, relatedId, applyToken)
        channelsSent.push("telegram")
        console.log("[v0] Telegram sent successfully!")
      } catch (telegramError) {
        console.error("[v0] Telegram sending failed:", telegramError)
        channelsFailed.push("telegram")
        errorMessage = telegramError instanceof Error ? telegramError.message : String(telegramError)
        console.log("[v0] Telegram added to channelsFailed:", channelsFailed)
      }
    } else {
      console.log("[v0] Telegram NOT enabled or no chat_id - skipping Telegram send")
    }

    console.log("[v0] Final notification status:", {
      channelsSent,
      channelsFailed,
      deliveryStatus,
      errorMessage,
    })

    if (channelsFailed.length > 0 && channelsSent.length === 1) {
      deliveryStatus = "partial"
    } else if (channelsFailed.length > 0) {
      deliveryStatus = "partial"
    } else if (channelsSent.length === 1) {
      deliveryStatus = "success"
    }

    if (notificationId) {
      await sql`
        UPDATE notifications 
        SET delivery_status = ${deliveryStatus},
            channels_sent = ${channelsSent},
            channels_failed = ${channelsFailed},
            error_message = ${errorMessage}
        WHERE id = ${notificationId}
      `
    }

    return {
      success: true,
      channelsSent,
      channelsFailed,
      deliveryStatus,
    }
  } catch (error) {
    console.error("[v0] Notification error:", error)
    return { error: "Erreur lors de la création de la notification" }
  }
}

export async function getUserPreferences(userId: number) {
  const prefs = await sql`
    SELECT 
      np.*,
      u.telegram_required
    FROM notification_preferences np
    LEFT JOIN users u ON u.id = np.user_id
    WHERE np.user_id = ${userId}
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
  relatedId?: number,
  relatedType?: string,
  sentBy?: number,
) {
  if (userIds.length === 0) return

  console.log(`[v0] Starting parallel notification creation for ${userIds.length} users`)
  const startTime = Date.now()

  try {
    // Create all notifications in parallel with Promise.allSettled
    // This ensures ALL notifications are attempted, even if some fail
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        let deliveryStatus: "pending" | "success" | "failed" | "partial" | "skipped" = "pending"
        const channelsSent: string[] = ["in_app"]
        const channelsFailed: string[] = []
        let errorMessage: string | null = null
        let notificationId: number | null = null

        try {
          // Insert notification in database
          await sql`
            INSERT INTO notifications (user_id, title, message, type, related_id, related_type, sent_by)
            VALUES (${userId}, ${title}, ${message}, ${type}, ${relatedId || null}, ${relatedType || null}, ${sentBy || null})
          `

          // Get the notification ID
          const notificationResult = await sql`
            SELECT id FROM notifications 
            WHERE user_id = ${userId} 
            AND type = ${type}
            AND created_at >= NOW() - INTERVAL '5 seconds'
            ORDER BY created_at DESC 
            LIMIT 1
          `
          notificationId = notificationResult[0]?.id || null

          // Get user preferences
          const userPrefs = await sql`
            SELECT 
              u.email,
              u.first_name,
              u.last_name,
              np.enable_telegram,
              np.telegram_chat_id,
              np.notify_replacement_available,
              np.notify_replacement_accepted,
              np.notify_replacement_rejected,
              u.telegram_required
            FROM users u
            LEFT JOIN notification_preferences np ON u.id = np.user_id
            WHERE u.id = ${userId}
          `

          if (userPrefs.length === 0) {
            deliveryStatus = "skipped"
            errorMessage = "User not found"
          } else {
            const user = userPrefs[0]
            const fullName = `${user.first_name} ${user.last_name}`

            // Check if user should receive this notification type
            let shouldReceive = true
            if (type === "replacement_available") {
              shouldReceive = user.notify_replacement_available !== false
            } else if (type === "replacement_accepted") {
              shouldReceive = user.notify_replacement_accepted !== false
            } else if (type === "replacement_rejected") {
              shouldReceive = user.notify_replacement_rejected !== false
            }

            if (!shouldReceive) {
              deliveryStatus = "skipped"
              errorMessage = "User opted out of this notification type"
            } else if (user.enable_telegram === true && user.telegram_chat_id) {
              // Send Telegram with retry
              console.log(`[v0] ---- TELEGRAM NOTIFICATION ----`)
              console.log(`[v0] User: ${fullName} (${userId})`)
              console.log(`[v0] ChatId: ${user.telegram_chat_id}`)
              console.log(`[v0] Type: ${type}`)
              console.log(`[v0] enable_telegram: ${user.enable_telegram}`)
              
              // Generate apply token for replacement_available notifications
              let applyToken: string | undefined
              if (type === "replacement_available" && relatedId) {
                applyToken = crypto.randomUUID()
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                
                try {
                  await sql`
                    INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
                    VALUES (${applyToken}, ${relatedId}, ${userId}, ${expiresAt})
                    ON CONFLICT (user_id, replacement_id) 
                    DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
                  `
                  console.log("[v0] Token created for batch Telegram:", applyToken)
                } catch (error) {
                  console.error("[v0] Error creating application token for batch Telegram:", error)
                  applyToken = undefined
                }
              }
              
              const telegramResult = await sendTelegramWithRetry(
                type,
                user.telegram_chat_id,
                fullName,
                message,
                relatedId || null,
                applyToken,
              )

              if (telegramResult.success) {
                channelsSent.push("telegram")
                deliveryStatus = "success"
                console.log(`[v0] ✓ Telegram delivered to ${fullName}`)
              } else {
                channelsFailed.push("telegram")
                errorMessage = telegramResult.error || "Telegram send failed"
                deliveryStatus = "partial"
                console.error(`[v0] ✗ Telegram failed for ${fullName}: ${errorMessage}`)
              }
            } else {
              deliveryStatus = "success"
              console.log(`[v0] Telegram skipped for ${fullName}`)
              if (!user.enable_telegram) console.log(`[v0]   Reason: enable_telegram = false`)
              if (!user.telegram_chat_id) console.log(`[v0]   Reason: telegram_chat_id not set`)
            }
          }

          // Update notification with delivery status
          if (notificationId) {
            await sql`
              UPDATE notifications 
              SET delivery_status = ${deliveryStatus},
                  channels_sent = ${channelsSent},
                  channels_failed = ${channelsFailed},
                  error_message = ${errorMessage}
              WHERE id = ${notificationId}
            `
          }

          return { userId, success: true, deliveryStatus, channelsSent, channelsFailed }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`[v0] Critical error for user ${userId}:`, errorMsg)

          // Try to update notification status even on critical error
          if (notificationId) {
            try {
              await sql`
                UPDATE notifications 
                SET delivery_status = 'failed',
                    channels_failed = ${["telegram", "in_app"]},
                    error_message = ${errorMsg}
                WHERE id = ${notificationId}
              `
            } catch (updateError) {
              console.error(`[v0] Failed to update notification ${notificationId}:`, updateError)
            }
          }

          return { userId, success: false, error: errorMsg }
        }
      }),
    )

    // Analyze results
    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
    ).length
    const telegramSent = results.filter(
      (r) => r.status === "fulfilled" && r.value.channelsSent?.includes("telegram"),
    ).length
    const telegramFailed = results.filter(
      (r) => r.status === "fulfilled" && r.value.channelsFailed?.includes("telegram"),
    ).length

    const duration = Date.now() - startTime
    console.log(`[v0] ═══════════════════════════════════════════════`)
    console.log(`[v0] Batch notification summary:`)
    console.log(`[v0] Total users: ${userIds.length}`)
    console.log(`[v0] Successful: ${successful}`)
    console.log(`[v0] Failed: ${failed}`)
    console.log(`[v0] Telegram sent: ${telegramSent}`)
    console.log(`[v0] Telegram failed: ${telegramFailed}`)
    console.log(`[v0] Duration: ${duration}ms (avg ${Math.round(duration / userIds.length)}ms/user)`)
    console.log(`[v0] ═══════════════════════════════════════════════`)

    // Log any failures with details
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[v0] User ${userIds[index]} rejected:`, result.reason)
      } else if (result.status === "fulfilled" && !result.value.success) {
        console.error(`[v0] User ${userIds[index]} failed:`, result.value.error)
      }
    })
  } catch (error) {
    console.error("[v0] Fatal error in batch notification creation:", error)
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

    const eligibleUsers = await sql`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        COALESCE(np.enable_email, true) as enable_email,
        COALESCE(np.notify_replacement_available, true) as notify_replacement_available,
        np.telegram_chat_id,
        COALESCE(np.enable_telegram, false) as enable_telegram
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

        let applyToken = crypto.randomUUID()
        console.log("[v0] Generated applyToken:", applyToken)

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7) // Token valid for 7 days
        console.log("[v0] Token expires at:", expiresAt)

        try {
          console.log("[v0] Inserting token into database...")
          await sql`
            INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
            VALUES (${applyToken}, ${replacementId}, ${user.id}, ${expiresAt})
            ON CONFLICT (user_id, ${replacementId}) 
            DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
          `
          console.log("[v0] Token inserted successfully")
        } catch (error) {
          console.error("[v0] Error creating application token:", error)
          applyToken = undefined
        }

        console.log("[v0] Calling getReplacementAvailableEmail with applyToken:", applyToken)
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
      }),
    )

    console.log("[v0] PRODUCTION: Email contents generated, calling sendBatchEmails...")

    const result = await sendBatchEmails(emails)

    console.log("[v0] PRODUCTION: sendBatchEmails returned:", result)

    if (!result.success) {
      console.error("[v0] PRODUCTION ERROR: Batch emails failed, notifying admins...")

      // The email failures should not create a separate notification card in the history
      // Email system is being phased out
      console.log("[v0] Email batch failed, but not creating system notification")
    }

    return {
      success: result.success,
      sent: result.sent || 0,
      failed: result.failed || 0,
      recipients: result.recipients || [],
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
  applyToken?: string,
) {
  console.log("[v0] sendTelegramNotificationMessage START - type:", type, "chatId:", chatId, "name:", name)

  let telegramMessage = ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://v0-l-horaire-ryan.vercel.app"
  console.log("[v0] App URL:", appUrl)

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

<a href="${appUrl}/apply-replacement?token=${applyToken}">Postuler</a>`
          console.log("[v0] Telegram message with token URL:", {
            token: applyToken,
            url: `${appUrl}/apply-replacement?token=${applyToken}`,
          })
        }
      }
      break

    case "replacement_accepted":
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
👤 Remplace: ${r.firefighter_to_replace || "Pompier supplémentaire"}`

          await sendTelegramMessage(chatId, telegramMessage, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✓ Confirmer la réception",
                    callback_data: `confirm_replacement_${relatedId}`,
                  },
                ],
              ],
            },
          })
          return // Exit early since we already sent the message with button
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
👤 Remplace: ${r.firefighter_to_replace || "Pompier supplémentaire"}`
        }
      }
      break

    case "manual_message":
      telegramMessage = `📢 <b>Message de l'administration</b>

${message}`
      break

    // This notification type is no longer supported
  }

  // Send message without button for other notification types
  console.log("[v0] About to call sendTelegramMessage with:")
  console.log("[v0]  - chatId:", chatId)
  console.log("[v0]  - message length:", (telegramMessage || message).length)
  console.log("[v0]  - message preview:", (telegramMessage || message).substring(0, 100))
  
  try {
    await sendTelegramMessage(chatId, telegramMessage || message, {
      parse_mode: "HTML",
    })
    console.log("[v0] ✓ sendTelegramMessage succeeded for chatId:", chatId)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[v0] ✗ sendTelegramMessage FAILED for chatId:", chatId)
    console.error("[v0] Error details:", errorMsg)
    console.error("[v0] Full error:", error)
    throw error
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
    return
  }

  let emailContent
  let applyToken: string | undefined

  switch (type) {
    case "replacement_available":
      if (relatedId && userId) {
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

          applyToken = crypto.randomUUID()

          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 7)

          try {
            await sql`
              INSERT INTO application_tokens (token, replacement_id, user_id, expires_at)
              VALUES (${applyToken}, ${relatedId}, ${userId}, ${expiresAt})
              ON CONFLICT (user_id, ${relatedId}) 
              DO UPDATE SET token = ${applyToken}, expires_at = ${expiresAt}, used = false
            `
          } catch (error) {
            console.error("Error creating application token:", error)
            applyToken = undefined
          }

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
      }
      break

    case "replacement_accepted":
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

    case "manual_message":
      emailContent = {
        subject: "Message important - Horaire SSIV",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .message-box { background-color: white; padding: 20px; border-left: 4px solid #ef4444; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">📢 Message de l'administration</h1>
                </div>
                <div class="content">
                  <p>Bonjour ${name},</p>
                  <div class="message-box">
                    <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                  </div>
                  <div class="footer">
                    <p>Service des incendies</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
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

async function sendTelegramWithRetry(
  type: string,
  chatId: string,
  fullName: string,
  message: string,
  relatedId: number | null,
  applyToken?: string,
  maxRetries = 3,
): Promise<{ success: boolean; error?: string }> {
  console.log("[v0] ========== TELEGRAM RETRY START ==========")
  console.log("[v0] Type:", type)
  console.log("[v0] ChatId:", chatId)
  console.log("[v0] FullName:", fullName)
  console.log("[v0] RelatedId:", relatedId)
  console.log("[v0] ApplyToken provided:", !!applyToken)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0] Telegram attempt ${attempt}/${maxRetries} for ${fullName} (chatId: ${chatId})`)
      await sendTelegramNotificationMessage(type, chatId, fullName, message, relatedId || undefined, applyToken)
      console.log(`[v0] ✓ Telegram sent successfully on attempt ${attempt}`)
      console.log("[v0] ========== TELEGRAM RETRY SUCCESS ==========")
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[v0] ✗ Telegram attempt ${attempt} FAILED:`, errorMessage)
      console.error(`[v0] Error stack:`, error instanceof Error ? error.stack : "No stack trace")

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`[v0] Waiting ${delay}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        console.error("[v0] ========== TELEGRAM RETRY FAILED (MAX RETRIES) ==========")
        return { success: false, error: errorMessage }
      }
    }
  }
  console.error("[v0] ========== TELEGRAM RETRY EXHAUSTED ==========")
  return { success: false, error: "Max retries exceeded" }
}
