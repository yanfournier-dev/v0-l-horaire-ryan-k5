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
  console.log("[v0] ========== SEND TELEGRAM MESSAGE START ==========")
  console.log("[v0] chatId:", chatId)
  console.log("[v0] text length:", text.length)
  console.log("[v0] parse_mode:", options?.parse_mode || "HTML")
  console.log("[v0] has reply_markup:", !!options?.reply_markup)

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[v0] Bot token not configured!")
    throw new Error("Bot token not configured")
  }

  console.log("[v0] TELEGRAM_BOT_TOKEN exists: YES")
  console.log("[v0] TELEGRAM_API_URL:", TELEGRAM_API_URL)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const requestBody = {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || "HTML",
      reply_markup: options?.reply_markup,
    }
    
    console.log("[v0] Request body prepared (text truncated):", {
      chat_id: chatId,
      text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      parse_mode: requestBody.parse_mode,
      has_reply_markup: !!requestBody.reply_markup,
    })

    console.log("[v0] Making fetch request to:", `${TELEGRAM_API_URL}/sendMessage`)
    
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    console.log("[v0] Response received. Status:", response.status)

    const data = await response.json()
    console.log("[v0] Response data:", data)

    if (!response.ok) {
      const errorMsg = data.description || `Telegram API error: ${response.status}`
      console.error("[v0] ✗ API returned error:", errorMsg)
      throw new Error(errorMsg)
    }

    console.log("[v0] ✓ Telegram message sent successfully")
    console.log("[v0] ========== SEND TELEGRAM MESSAGE SUCCESS ==========")
    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] ✗ Exception caught in sendTelegramMessage:")
    console.error("[v0] Error name:", error.name)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)
    
    if (error.name === "AbortError") {
      console.error("[v0] ✗ Telegram request timeout (10s)")
      throw new Error("Telegram request timeout (10s)")
    }
    
    console.error("[v0] ========== SEND TELEGRAM MESSAGE FAILED ==========")
    throw new Error(error.message || "Unknown Telegram error")
  }
}

/**
 * Gets information about the bot
 */
export async function getBotInfo() {
  console.log("[v0] getBotInfo called")
  console.log("[v0] TELEGRAM_BOT_TOKEN exists:", !!TELEGRAM_BOT_TOKEN)

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[v0] Bot token not configured")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    console.log("[v0] Fetching bot info from Telegram API...")
    const response = await fetch(`${TELEGRAM_API_URL}/getMe`)
    const data = await response.json()

    console.log("[v0] Telegram API response:", data)

    if (!response.ok) {
      console.error("[v0] Telegram API error:", data.description)
      return { success: false, error: data.description }
    }

    console.log("[v0] Bot info retrieved successfully:", data.result.username)
    return { success: true, data: data.result }
  } catch (error: any) {
    console.error("[v0] Error in getBotInfo:", error)
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

// Additional updates can be inserted here if needed
