"use server"

import { sql } from "@/lib/db"
import { getSession } from "./auth"

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
        u.is_owner,
        u.telegram_required,
        np.telegram_chat_id,
        np.enable_telegram,
        u.created_at as user_created_at,
        np.updated_at as telegram_updated_at
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      ORDER BY 
        CASE WHEN np.telegram_chat_id IS NOT NULL THEN 0 ELSE 1 END,
        u.last_name, 
        u.first_name
    `

    const requiredUsers = users.filter((u: any) => u.telegram_required)
    const connectedRequiredCount = requiredUsers.filter((u: any) => u.telegram_chat_id).length
    const totalRequiredCount = requiredUsers.length

    return {
      users,
      currentUserId: user.id,
      currentUserIsOwner: user.is_owner || false,
      stats: {
        connected: connectedRequiredCount,
        notConnected: totalRequiredCount - connectedRequiredCount,
        requiredNotConnected: totalRequiredCount - connectedRequiredCount,
        total: totalRequiredCount,
        percentage: totalRequiredCount > 0 ? Math.round((connectedRequiredCount / totalRequiredCount) * 100) : 0,
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

export async function toggleTelegramRequirement(userId: number, required: boolean) {
  const currentUser = await getSession()

  if (!currentUser?.is_owner) {
    return { error: "Seul le propriétaire peut modifier cette option" }
  }

  try {
    const userResult = await sql`
      SELECT first_name, last_name, telegram_required 
      FROM users 
      WHERE id = ${userId}
    `

    if (userResult.length === 0) {
      return { error: "Utilisateur introuvable" }
    }

    const user = userResult[0]
    const oldValue = user.telegram_required

    await sql`
      UPDATE users 
      SET telegram_required = ${required}
      WHERE id = ${userId}
    `

    if (required) {
      // Activate Telegram notifications when made required
      await sql`
        UPDATE notification_preferences 
        SET enable_telegram = true
        WHERE user_id = ${userId}
      `
    } else {
      // Deactivate Telegram notifications when no longer required
      await sql`
        UPDATE notification_preferences 
        SET enable_telegram = false
        WHERE user_id = ${userId}
      `
    }

    await sql`
      INSERT INTO audit_logs (
        user_id,
        action_type,
        table_name,
        record_id,
        old_values,
        new_values,
        description
      ) VALUES (
        ${currentUser.id},
        'telegram_requirement_changed',
        'users',
        ${userId},
        ${JSON.stringify({ telegram_required: oldValue })},
        ${JSON.stringify({ telegram_required: required })},
        ${`Modification de l'obligation Telegram pour ${user.first_name} ${user.last_name}: ${oldValue ? "Obligatoire" : "Optionnel"} → ${required ? "Obligatoire" : "Optionnel"}`}
      )
    `

    return { success: true }
  } catch (error) {
    console.error("toggleTelegramRequirement error:", error)
    return { error: "Erreur lors de la modification" }
  }
}
