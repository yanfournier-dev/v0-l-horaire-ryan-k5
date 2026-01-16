import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendTelegramMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

/**
 * Telegram Webhook endpoint
 * Receives updates from Telegram when users interact with the bot
 */
export async function POST(request: NextRequest) {
  console.log("[v0] Telegram webhook received")

  try {
    const body = await request.json()
    console.log("[v0] Telegram update:", JSON.stringify(body, null, 2))

    // Handle callback queries (button clicks)
    const callbackQuery = body.callback_query
    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id.toString()
      const callbackData = callbackQuery.data
      const messageId = callbackQuery.message.message_id

      console.log("[v0] Callback query received:", callbackData)

      // Handle replacement confirmation
      if (callbackData?.startsWith("confirm_replacement_")) {
        const replacementId = Number.parseInt(callbackData.replace("confirm_replacement_", ""))
        console.log("[v0] Confirming replacement:", replacementId)

        try {
          // Update replacement with current timestamp (stored as UTC in DB) and get formatted date
          const result = await sql`
            UPDATE replacements 
            SET confirmed_at = NOW(), 
                confirmed_via = 'telegram' 
            WHERE id = ${replacementId}
            RETURNING 
              id,
              TO_CHAR(confirmed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24 "h" MI "min" SS "s"') as formatted_date
          `

          const confirmedDate = result[0]?.formatted_date

          if (!confirmedDate) {
            throw new Error("No formatted date returned from database")
          }

          console.log("[v0] Formatted date for Telegram:", confirmedDate)

          // Edit message to show confirmed status
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: callbackQuery.message.text + `\n\n✅ <b>Réception confirmée le ${confirmedDate}</b>`,
              parse_mode: "HTML",
            }),
          })

          console.log("[v0] Replacement confirmed successfully:", replacementId)
        } catch (error) {
          console.error("[v0] Error confirming replacement:", error)
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: "❌ Erreur lors de la confirmation",
              show_alert: true,
            }),
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Extract message data
    const message = body.message
    if (!message) {
      console.log("[v0] No message in update, ignoring")
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id.toString()
    const text = message.text
    const from = message.from

    console.log("[v0] Message from:", from.username || from.first_name, "chatId:", chatId, "text:", text)

    // Handle /start command with linking code
    if (text?.startsWith("/start ")) {
      const code = text.replace("/start ", "").trim().toUpperCase()
      console.log("[v0] Received linking code:", code)

      // Check if code exists and is valid
      const linkCodes = await sql`
        SELECT user_id, expires_at, used_at
        FROM telegram_link_codes
        WHERE code = ${code}
      `

      if (linkCodes.length === 0) {
        console.log("[v0] Invalid code:", code)
        await sendTelegramMessage(
          chatId,
          "❌ <b>Code invalide</b>\n\nCe code de liaison n'existe pas. Veuillez générer un nouveau code depuis l'application.",
        )
        return NextResponse.json({ ok: true })
      }

      const linkCode = linkCodes[0]

      // Check if already used
      if (linkCode.used_at) {
        console.log("[v0] Code already used:", code)
        await sendTelegramMessage(
          chatId,
          "⚠️ <b>Code déjà utilisé</b>\n\nCe code a déjà été utilisé. Veuillez générer un nouveau code depuis l'application.",
        )
        return NextResponse.json({ ok: true })
      }

      // Check if expired
      if (new Date(linkCode.expires_at) < new Date()) {
        console.log("[v0] Code expired:", code)
        await sendTelegramMessage(
          chatId,
          "⏰ <b>Code expiré</b>\n\nCe code a expiré. Les codes sont valides pendant 15 minutes. Veuillez générer un nouveau code depuis l'application.",
        )
        return NextResponse.json({ ok: true })
      }

      // Link the account
      const userId = linkCode.user_id

      // Update notification_preferences with chat_id
      await sql`
        UPDATE notification_preferences
        SET telegram_chat_id = ${chatId}
        WHERE user_id = ${userId}
      `

      // Mark code as used
      await sql`
        UPDATE telegram_link_codes
        SET used_at = NOW(), chat_id = ${chatId}
        WHERE code = ${code}
      `

      console.log("[v0] Telegram account linked successfully for user:", userId)

      // Send confirmation message
      await sendTelegramMessage(
        chatId,
        "✅ <b>Compte connecté avec succès!</b>\n\n" +
          "Votre compte Telegram est maintenant lié à Horaire SSIV.\n\n" +
          "Vous pouvez maintenant activer les notifications Telegram dans vos paramètres de l'application.\n\n" +
          "Vous recevrez des notifications pour:\n" +
          "• Nouveaux remplacements disponibles\n" +
          "• Candidatures acceptées\n" +
          "• Candidatures rejetées",
      )

      return NextResponse.json({ ok: true })
    }

    // Handle /start without code (first time user)
    if (text === "/start") {
      console.log("[v0] User started bot without code")
      await sendTelegramMessage(
        chatId,
        "👋 <b>Bienvenue sur Horaire SSIV Bot!</b>\n\n" +
          "Pour connecter votre compte:\n" +
          "1. Allez dans l'application web\n" +
          "2. Paramètres → Notifications\n" +
          "3. Cliquez sur 'Connecter Telegram'\n" +
          "4. Cliquez sur le lien généré\n\n" +
          "Vous serez ensuite automatiquement connecté.",
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        "ℹ️ <b>Aide - Horaire SSIV Bot</b>\n\n" +
          "<b>Commandes disponibles:</b>\n" +
          "/start - Démarrer le bot\n" +
          "/help - Afficher cette aide\n" +
          "/status - Vérifier le statut de connexion\n\n" +
          "Pour toute question, contactez votre administrateur.",
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /status command
    if (text === "/status") {
      // Check if this chat_id is linked to a user
      const prefs = await sql`
        SELECT user_id, enable_telegram
        FROM notification_preferences
        WHERE telegram_chat_id = ${chatId}
      `

      if (prefs.length === 0) {
        await sendTelegramMessage(
          chatId,
          "❌ <b>Non connecté</b>\n\nVotre compte Telegram n'est pas encore lié. Utilisez la commande /start avec un code de liaison depuis l'application.",
        )
      } else {
        const pref = prefs[0]
        const status = pref.enable_telegram ? "activées ✅" : "désactivées ❌"
        await sendTelegramMessage(
          chatId,
          `✅ <b>Compte connecté</b>\n\nNotifications Telegram: ${status}\n\nVous pouvez modifier ce paramètre dans l'application web.`,
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Unknown command
    console.log("[v0] Unknown command:", text)
    await sendTelegramMessage(
      chatId,
      "❓ Commande non reconnue.\n\nUtilisez /help pour voir les commandes disponibles.",
    )

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[v0] Error processing Telegram webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", service: "telegram-webhook" })
}
