import { type NextRequest, NextResponse } from "next/server"

/**
 * Setup Telegram webhook
 * This endpoint configures the Telegram bot to send updates to our webhook
 *
 * Usage: Visit /api/telegram/setup-webhook in your browser to configure the webhook
 */
export async function GET(request: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 })
    }

    // Get the application URL
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const webhookUrl = `${baseUrl}/api/telegram/webhook`

    console.log("[v0] Setting up Telegram webhook:", webhookUrl)

    // Set the webhook URL in Telegram
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"], // Only receive messages and button clicks
        drop_pending_updates: true, // Clear old updates
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("[v0] Failed to set webhook:", data)
      return NextResponse.json(
        {
          success: false,
          error: data.description,
          webhookUrl,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Webhook configured successfully")

    // Get webhook info to confirm
    const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const webhookInfo = await infoResponse.json()

    return NextResponse.json({
      success: true,
      message: "Webhook configured successfully!",
      webhookUrl,
      webhookInfo: webhookInfo.result,
    })
  } catch (error: any) {
    console.error("[v0] Error setting up webhook:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
