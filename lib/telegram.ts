"use server"

/**
 * Utility functions for Telegram Bot API integration
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

/**
 * Sends a message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    parse_mode?: "HTML" | "Markdown"
    reply_markup?: any
  },
) {
  console.log("[v0] sendTelegramMessage called for chat:", chatId)

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[v0] TELEGRAM_BOT_TOKEN is not configured")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parse_mode || "HTML",
        reply_markup: options?.reply_markup,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[v0] Telegram API error:", data)
      return { success: false, error: data.description }
    }

    console.log("[v0] Telegram message sent successfully")
    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Error sending Telegram message:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Gets information about the bot
 */
export async function getBotInfo() {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMe`)
    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.description }
    }

    return { success: true, data: data.result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Sets the webhook URL for receiving updates
 */
export async function setTelegramWebhook(webhookUrl: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.description }
    }

    return { success: true, data: data.result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
