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

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié" }
  }

  const userId = session.user.id

  try {
    // Generate a unique 8-character code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // Expires in 15 minutes

    console.log("[v0] Generated link code:", code, "for user:", userId)

    // Store the code in the database
    await sql`
      INSERT INTO telegram_link_codes (code, user_id, expires_at)
      VALUES (${code}, ${userId}, ${expiresAt})
      ON CONFLICT (code) DO NOTHING
    `

    // Get bot username
    const botInfo = await getBotInfo()
    if (!botInfo.success) {
      console.error("[v0] Failed to get bot info:", botInfo.error)
      return { success: false, error: "Impossible de se connecter au bot" }
    }

    const botUsername = botInfo.data.username

    // Create deep link: https://t.me/botname?start=CODE
    const deepLink = `https://t.me/${botUsername}?start=${code}`

    console.log("[v0] Generated Telegram deep link:", deepLink)

    return {
      success: true,
      link: deepLink,
      code,
      expiresIn: 15, // minutes
    }
  } catch (error: any) {
    console.error("[v0] Error generating Telegram link:", error)
    return { success: false, error: "Erreur lors de la génération du lien" }
  }
}

/**
 * Disconnects the user's Telegram account
 */
export async function disconnectTelegram() {
  console.log("[v0] disconnectTelegram called")

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié" }
  }

  const userId = session.user.id

  try {
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
  if (!session?.user?.id) {
    return { connected: false }
  }

  const userId = session.user.id

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
