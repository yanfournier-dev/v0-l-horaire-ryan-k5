"use server"

import { neon } from "@neondatabase/serverless"
import { getSession } from "./auth"

const sql = neon(process.env.DATABASE_URL!)

export async function getTelegramConnectionStatus() {
  const user = await getSession()

  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const users = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        np.telegram_chat_id,
        np.enable_telegram,
        u.created_at as user_created_at,
        np.updated_at as telegram_updated_at
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.is_admin = false
      ORDER BY 
        CASE WHEN np.telegram_chat_id IS NOT NULL THEN 0 ELSE 1 END,
        u.last_name, 
        u.first_name
    `

    const connectedCount = users.filter((u: any) => u.telegram_chat_id).length
    const totalCount = users.length

    return {
      users,
      stats: {
        connected: connectedCount,
        notConnected: totalCount - connectedCount,
        total: totalCount,
        percentage: totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0,
      },
    }
  } catch (error) {
    console.error("getTelegramConnectionStatus error:", error)
    return { error: "Erreur lors de la récupération des statuts" }
  }
}

export async function checkUserTelegramStatus(userId: number) {
  try {
    const result = await sql`
      SELECT telegram_chat_id, enable_telegram
      FROM notification_preferences
      WHERE user_id = ${userId}
    `

    return {
      isConnected: !!result[0]?.telegram_chat_id,
      chatId: result[0]?.telegram_chat_id,
    }
  } catch (error) {
    console.error("checkUserTelegramStatus error:", error)
    return { isConnected: false, chatId: null }
  }
}
