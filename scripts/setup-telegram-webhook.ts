const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`
  : "https://v0-l-horaire-ryan.vercel.app/api/telegram/webhook"

async function setupWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not set in environment variables")
    process.exit(1)
  }

  console.log(`🔧 Setting up Telegram webhook...`)
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`)

  try {
    // Set the webhook
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    })

    const data = await response.json()

    if (data.ok) {
      console.log("✅ Webhook configured successfully!")
      console.log("📋 Webhook info:", data.result)

      // Verify webhook info
      const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const infoData = await infoResponse.json()

      if (infoData.ok) {
        console.log("\n📊 Current webhook status:")
        console.log(`   URL: ${infoData.result.url}`)
        console.log(`   Pending updates: ${infoData.result.pending_update_count}`)
        console.log(`   Max connections: ${infoData.result.max_connections || 40}`)

        if (infoData.result.last_error_message) {
          console.log(`   ⚠️ Last error: ${infoData.result.last_error_message}`)
        }
      }
    } else {
      console.error("❌ Failed to configure webhook:", data.description)
      process.exit(1)
    }
  } catch (error) {
    console.error("❌ Error setting up webhook:", error)
    process.exit(1)
  }
}

setupWebhook()
