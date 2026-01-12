"use server"

import { neon } from "@neondatabase/serverless"
import { getSession } from "./auth"
import { createNotification } from "./notifications"

const sql = neon(process.env.DATABASE_URL!)

export async function getFirefighters() {
  try {
    console.log("[v0] getFirefighters: Starting")
    const session = await getSession()
    console.log("[v0] getFirefighters: Session", { hasSession: !!session, role: session?.role })

    if (!session || session.role !== "captain") {
      console.log("[v0] getFirefighters: Access denied")
      return { success: false, error: "Accès refusé", firefighters: [] }
    }

    console.log("[v0] getFirefighters: Fetching from database")
    const firefighters = await sql`
      SELECT 
        id, 
        last_name || ', ' || first_name as name,
        email 
      FROM users 
      ORDER BY last_name ASC, first_name ASC
    `

    console.log("[v0] getFirefighters: Found", { count: firefighters.length })
    console.log("[v0] getFirefighters: Firefighters data", firefighters)

    return {
      success: true,
      firefighters: firefighters as Array<{ id: number; name: string; email: string }>,
    }
  } catch (error) {
    console.error("[v0] getFirefighters: Error", error)
    return { success: false, error: "Erreur lors de la récupération", firefighters: [] }
  }
}

export async function sendManualNotification(message: string, recipientIds: number[]) {
  try {
    console.log("[v0] sendManualNotification: Starting", {
      messageLength: message.length,
      recipientCount: recipientIds.length,
    })

    const session = await getSession()
    if (!session) {
      console.log("[v0] sendManualNotification: No session")
      return { success: false, error: "Non authentifié" }
    }

    if (session.role !== "captain") {
      console.log("[v0] sendManualNotification: Not admin", {
        role: session.role,
      })
      return { success: false, error: "Accès refusé - Admin seulement" }
    }

    if (!message || message.trim().length === 0) {
      return { success: false, error: "Le message ne peut pas être vide" }
    }

    if (message.length > 500) {
      return {
        success: false,
        error: "Le message ne peut pas dépasser 500 caractères",
      }
    }

    if (!recipientIds || recipientIds.length === 0) {
      return {
        success: false,
        error: "Veuillez sélectionner au moins un destinataire",
      }
    }

    console.log("[v0] sendManualNotification: Validation passed")

    const result = await sql`
      INSERT INTO manual_notifications (message, sent_by, recipient_ids)
      VALUES (${message.trim()}, ${session.id}, ${recipientIds})
      RETURNING id
    `

    const notificationId = result[0].id
    console.log("[v0] sendManualNotification: Saved to history", {
      notificationId,
    })

    let successCount = 0
    let partialCount = 0
    let failedCount = 0
    let skippedCount = 0

    const deliveryDetails: Array<{
      name: string
      channels: {
        inApp: boolean
        email: boolean | "disabled"
        telegram: boolean | "disabled"
      }
      status: "success" | "partial" | "failed" | "skipped"
    }> = []

    for (const recipientId of recipientIds) {
      const channelsSent: string[] = []
      const channelsFailed: string[] = []
      let errorMessage: string | null = null
      let deliveryStatus: "success" | "partial" | "failed" | "skipped" = "failed"

      try {
        const userPrefs = await sql`
          SELECT 
            u.id,
            u.first_name || ' ' || u.last_name as name,
            np.enable_email,
            np.enable_telegram,
            np.telegram_chat_id
          FROM users u
          LEFT JOIN notification_preferences np ON u.id = np.user_id
          WHERE u.id = ${recipientId}
        `

        if (userPrefs.length === 0) {
          deliveryStatus = "skipped"
          errorMessage = "Utilisateur non trouvé"
          skippedCount++

          deliveryDetails.push({
            name: "Utilisateur inconnu",
            channels: { inApp: false, email: "disabled", telegram: "disabled" },
            status: "skipped",
          })
        } else {
          const user = userPrefs[0]

          console.log("[v0] Sending to user:", {
            id: user.id,
            name: user.name,
            enableEmail: user.enable_email,
            enableTelegram: user.enable_telegram,
            telegramChatId: user.telegram_chat_id,
          })

          const channelStatus = {
            inApp: false,
            email: user.enable_email === true ? false : ("disabled" as const),
            telegram: user.enable_telegram === true && user.telegram_chat_id ? false : ("disabled" as const),
          }

          try {
            await createNotification(
              recipientId,
              "Message de l'administration",
              message.trim(),
              "manual_message",
              null,
              null,
            )

            // In-app always succeeds if createNotification doesn't throw
            channelsSent.push("in_app")
            channelStatus.inApp = true

            if (user.enable_email === true) {
              channelsSent.push("email")
              channelStatus.email = true
            }

            if (user.enable_telegram === true && user.telegram_chat_id) {
              channelsSent.push("telegram")
              channelStatus.telegram = true
            }

            console.log("[v0] createNotification called successfully for user", recipientId, "channels:", channelsSent)

            const enabledChannels = [
              true, // in_app always enabled
              user.enable_email === true,
              user.enable_telegram === true && user.telegram_chat_id,
            ].filter(Boolean).length

            const sentChannels = channelsSent.length

            if (sentChannels === enabledChannels && enabledChannels > 1) {
              deliveryStatus = "success"
              successCount++
            } else if (sentChannels === 1 && enabledChannels === 1) {
              // Only in-app available and sent = success
              deliveryStatus = "success"
              successCount++
            } else {
              // Some channels enabled but not all sent = partial
              deliveryStatus = "partial"
              partialCount++
            }

            deliveryDetails.push({
              name: user.name,
              channels: channelStatus,
              status: deliveryStatus,
            })
          } catch (notificationError) {
            deliveryStatus = "failed"
            errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError)
            failedCount++
            console.error("[v0] createNotification failed for user", recipientId, notificationError)

            deliveryDetails.push({
              name: user.name,
              channels: { inApp: false, email: "disabled", telegram: "disabled" },
              status: "failed",
            })
          }
        }

        await sql`
          INSERT INTO manual_notification_deliveries (
            manual_notification_id,
            user_id,
            delivery_status,
            channels_sent,
            channels_failed,
            error_message
          )
          VALUES (
            ${notificationId},
            ${recipientId},
            ${deliveryStatus},
            ${channelsSent},
            ${channelsFailed},
            ${errorMessage}
          )
        `

        console.log("[v0] Recorded delivery for user", recipientId, "status:", deliveryStatus)
      } catch (error) {
        failedCount++
        console.error("[v0] Error sending to user", recipientId, error)

        await sql`
          INSERT INTO manual_notification_deliveries (
            manual_notification_id,
            user_id,
            delivery_status,
            channels_sent,
            channels_failed,
            error_message
          )
          VALUES (
            ${notificationId},
            ${recipientId},
            ${"failed"},
            ${[]},
            ${["in_app", "email", "telegram"]},
            ${error instanceof Error ? error.message : String(error)}
          )
        `

        deliveryDetails.push({
          name: "Erreur",
          channels: { inApp: false, email: false, telegram: false },
          status: "failed",
        })
      }
    }

    console.log("[v0] sendManualNotification: Completed", {
      successCount,
      partialCount,
      failedCount,
      skippedCount,
    })

    return {
      success: true,
      summary: {
        successCount: successCount,
        partialCount: partialCount,
        failedCount: failedCount,
        skippedCount: skippedCount,
      },
      deliveryDetails, // Return detailed delivery information
      message: `Notification envoyée à ${successCount + partialCount} pompier(s) sur ${recipientIds.length}`,
    }
  } catch (error) {
    console.error("[v0] sendManualNotification: Unexpected error", error)
    return {
      success: false,
      error: "Erreur lors de l'envoi de la notification",
    }
  }
}

export async function getManualNotificationHistory() {
  try {
    const session = await getSession()
    if (!session || session.role !== "captain") {
      return { success: false, error: "Accès refusé" }
    }

    const history = await sql`
      SELECT 
        mn.id,
        mn.message,
        mn.sent_at,
        mn.recipient_ids,
        u.first_name || ' ' || u.last_name as sent_by_name
      FROM manual_notifications mn
      LEFT JOIN users u ON mn.sent_by = u.id
      ORDER BY mn.sent_at DESC
      LIMIT 50
    `

    return { success: true, history }
  } catch (error) {
    console.error("[v0] getManualNotificationHistory: Error", error)
    return { success: false, error: "Erreur lors de la récupération" }
  }
}
