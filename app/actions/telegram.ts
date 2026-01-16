"use server"

import { getSession } from "@/app/actions/auth"
import { neon } from "@neondatabase/serverless"
import { getBotInfo } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

/**
 * Generates a deep link for the user to connect their Telegram account
 * The user clicks this link, opens Telegram, and the bot receives their chat_id
 */
export async function generateTelegramLink() {
  console.log("[v0] generateTelegramLink called")

  try {
    console.log("[v0] Step 1: Getting session...")
    const session = await getSession()
    console.log("[v0] Step 2: Session result:", session ? "exists" : "null")

    if (!session?.id) {
      console.log("[v0] No session or user ID found")
      return { success: false, error: "Non authentifié" }
    }

    const userId = session.id
    console.log("[v0] Step 3: User ID:", userId)

    // Generate a unique 8-character code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // Expires in 15 minutes
    console.log("[v0] Step 4: Generated code:", code)

    // Store the code in the database
    console.log("[v0] Step 5: Inserting code into database...")
    await sql`
      INSERT INTO telegram_link_codes (code, user_id, expires_at)
      VALUES (${code}, ${userId}, ${expiresAt})
      ON CONFLICT (code) DO NOTHING
    `
    console.log("[v0] Step 6: Code inserted successfully")

    // Get bot username
    console.log("[v0] Step 7: Getting bot info...")
    const botInfo = await getBotInfo()
    console.log("[v0] Step 8: Bot info result:", botInfo)

    if (!botInfo.success) {
      console.error("[v0] Failed to get bot info:", botInfo.error)
      return { success: false, error: "Impossible de se connecter au bot" }
    }

    const botUsername = botInfo.data.username
    console.log("[v0] Step 9: Bot username:", botUsername)

    // Create deep link: https://t.me/botname?start=CODE
    const deepLink = `https://t.me/${botUsername}?start=${code}`
    console.log("[v0] Step 10: Generated deep link:", deepLink)

    return {
      success: true,
      link: deepLink,
      code,
      expiresIn: 15, // minutes
    }
  } catch (error: any) {
    console.error("[v0] Error in generateTelegramLink:", error.message, error.stack)
    return { success: false, error: "Erreur lors de la génération du lien" }
  }
}

/**
 * Disconnects the user's Telegram account
 */
export async function disconnectTelegram() {
  console.log("[v0] disconnectTelegram called")

  const session = await getSession()
  if (!session?.id) {
    return { success: false, error: "Non authentifié" }
  }

  const userId = session.id

  try {
    const userCheck = await sql`
      SELECT telegram_required
      FROM users
      WHERE id = ${userId}
    `

    if (userCheck.length > 0 && userCheck[0].telegram_required === true) {
      console.log("[v0] Telegram disconnection blocked - telegram_required is true for user:", userId)
      return {
        success: false,
        error: "Déconnexion non autorisée - Telegram est obligatoire pour votre compte",
      }
    }

    // Remove telegram_chat_id and disable telegram notifications
    await sql`
      UPDATE notification_preferences
      SET telegram_chat_id = NULL, enable_telegram = false
      WHERE user_id = ${userId}
    `

    console.log("[v0] Telegram disconnected for user:", userId)

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error disconnecting Telegram:", error)
    return { success: false, error: "Erreur lors de la déconnexion" }
  }
}

/**
 * Checks if the user has connected their Telegram account
 */
export async function checkTelegramStatus() {
  const session = await getSession()
  if (!session?.id) {
    return { connected: false }
  }

  const userId = session.id

  try {
    const result = await sql`
      SELECT telegram_chat_id, enable_telegram
      FROM notification_preferences
      WHERE user_id = ${userId}
    `

    if (result.length === 0) {
      return { connected: false }
    }

    const prefs = result[0]
    return {
      connected: !!prefs.telegram_chat_id,
      enabled: prefs.enable_telegram,
      chatId: prefs.telegram_chat_id,
    }
  } catch (error: any) {
    console.error("[v0] Error checking Telegram status:", error)
    return { connected: false }
  }
}

/**
 * Sets up the Telegram webhook (owner only)
 * Securely configures the webhook URL with Telegram's API
 */
export async function setupTelegramWebhook() {
  const session = await getSession()

  if (!session?.id || !session.is_owner) {
    return { success: false, error: "Non autorisé - Propriétaire uniquement" }
  }

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return { success: false, error: "Token Telegram non configuré" }
    }

    // Get the app URL from environment or construct it
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL

    if (!appUrl) {
      return { success: false, error: "URL de l'application non configurée" }
    }

    const webhookUrl = `${appUrl.startsWith("http") ? appUrl : `https://${appUrl}`}/api/telegram/webhook`

    // Call Telegram API to set webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
      { method: "POST" },
    )

    const data = await response.json()

    if (data.ok) {
      return {
        success: true,
        message: `Webhook configuré avec succès!\nURL: ${webhookUrl}`,
      }
    } else {
      return {
        success: false,
        error: `Erreur Telegram: ${data.description || "Configuration échouée"}`,
      }
    }
  } catch (error: any) {
    console.error("[v0] Error setting up webhook:", error)
    return {
      success: false,
      error: `Erreur réseau: ${error.message}`,
    }
  }
}
