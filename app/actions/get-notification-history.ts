"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { isUserAdmin } from "@/app/actions/admin"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/app/actions/audit"

export interface NotificationRecipient {
  user_id: number
  user_name: string
  channels_sent: string[] | null
  channels_failed: string[] | null
  created_at: string
}

export interface NotificationHistoryItem {
  id: number
  title: string
  message: string
  type: string
  related_id: number | null
  related_type: string | null
  delivery_status: string | null
  sent_by: number | null
  sent_by_name: string | null
  created_at: string
  recipients: NotificationRecipient[]
}

export interface NotificationHistoryFilters {
  type?: string
  deliveryStatus?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export async function getNotificationHistory(filters: NotificationHistoryFilters = {}) {
  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  const userIsAdmin = await isUserAdmin()
  if (!userIsAdmin) {
    return { success: false, error: "Accès refusé - Réservé aux admins" }
  }

  const { type, deliveryStatus, startDate, endDate, page = 1, limit = 50 } = filters
  const offset = (page - 1) * limit

  try {
    let countQuery
    let dataQuery

    // Build queries based on filters
      if (!type || type === "all") {
      if (!deliveryStatus || deliveryStatus === "all") {
        // No filters
        countQuery = sql`
          SELECT COUNT(*) as total FROM (
            SELECT type, related_id
            FROM notifications
            GROUP BY type, related_id
          ) grouped
        `
        dataQuery = sql`
          SELECT 
            MIN(n.id) as id,
            n.type,
            MAX(n.title) as title,
            MAX(n.message) as message,
            n.related_id,
            MAX(n.related_type) as related_type,
            MAX(n.delivery_status) as delivery_status,
            MAX(n.sent_by) as sent_by,
            MAX(sender.first_name || ' ' || sender.last_name) as sent_by_name,
            MAX(n.created_at) as created_at,
            COALESCE(BOOL_OR(n.error_acknowledged), false) as error_acknowledged,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed,
                'created_at', n.created_at
              ) ORDER BY n.created_at
            ) as recipients
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          GROUP BY n.type, n.related_id
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
    } else {
      // Only type filter
      countQuery = sql`
        SELECT COUNT(*) as total FROM (
          SELECT type, related_id
          FROM notifications
          WHERE type = ${type}
          GROUP BY type, related_id
        ) grouped
      `
      dataQuery = sql`
        SELECT 
          MIN(n.id) as id,
          n.type,
          MAX(n.title) as title,
          MAX(n.message) as message,
          n.related_id,
          MAX(n.related_type) as related_type,
          MAX(n.delivery_status) as delivery_status,
          MAX(n.sent_by) as sent_by,
          MAX(sender.first_name || ' ' || sender.last_name) as sent_by_name,
          MAX(n.created_at) as created_at,
          MAX(n.error_acknowledged) as error_acknowledged,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'user_id', n.user_id,
              'user_name', u.first_name || ' ' || u.last_name,
              'channels_sent', n.channels_sent,
              'channels_failed', n.channels_failed,
              'created_at', n.created_at
            ) ORDER BY n.created_at
          ) as recipients
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        LEFT JOIN users sender ON n.sent_by = sender.id
        WHERE n.type = ${type}
        GROUP BY n.type, n.related_id
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
        dataQuery = sql`
          SELECT 
            MIN(n.id) as id,
            n.type,
            MAX(n.title) as title,
            MAX(n.message) as message,
            n.related_id,
            MAX(n.related_type) as related_type,
            MAX(n.delivery_status) as delivery_status,
            MAX(n.sent_by) as sent_by,
            MAX(sender.first_name || ' ' || sender.last_name) as sent_by_name,
            MAX(n.created_at) as created_at,
            COALESCE(BOOL_OR(n.error_acknowledged), false) as error_acknowledged,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed,
                'created_at', n.created_at
              ) ORDER BY n.created_at
            ) as recipients
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.delivery_status = ${deliveryStatus}
          GROUP BY n.type, n.related_id
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }
    } else {
      if (!deliveryStatus || deliveryStatus === "all") {
        // Only type filter
        countQuery = sql`
          SELECT COUNT(*) as total FROM (
            SELECT type, related_id
            FROM notifications
            WHERE type = ${type}
            GROUP BY type, related_id
          ) grouped
        `
        dataQuery = sql`
          SELECT 
            MIN(n.id) as id,
            n.type,
            MAX(n.title) as title,
            MAX(n.message) as message,
            n.related_id,
            MAX(n.related_type) as related_type,
            MAX(n.delivery_status) as delivery_status,
            MAX(n.sent_by) as sent_by,
            MAX(sender.first_name || ' ' || sender.last_name) as sent_by_name,
            MAX(n.created_at) as created_at,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed,
                'created_at', n.created_at
              ) ORDER BY n.created_at
            ) as recipients
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.type = ${type}
          GROUP BY n.type, n.related_id
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        // Both type and delivery status filters
        countQuery = sql`
          SELECT COUNT(*) as total FROM (
            SELECT type, related_id
            FROM notifications
            WHERE type = ${type} AND delivery_status = ${deliveryStatus}
            GROUP BY type, related_id
          ) grouped
        `
        dataQuery = sql`
          SELECT 
            MIN(n.id) as id,
            n.type,
            MAX(n.title) as title,
            MAX(n.message) as message,
            n.related_id,
            MAX(n.related_type) as related_type,
            MAX(n.delivery_status) as delivery_status,
            MAX(n.sent_by) as sent_by,
            MAX(sender.first_name || ' ' || sender.last_name) as sent_by_name,
            MAX(n.created_at) as created_at,
            COALESCE(BOOL_OR(n.error_acknowledged), false) as error_acknowledged,
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed,
                'created_at', n.created_at
              ) ORDER BY n.created_at
            ) as recipients
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.type = ${type} AND n.delivery_status = ${deliveryStatus}
          GROUP BY n.type, n.related_id
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }
    }

    const countResult = await countQuery
    const totalCount = Number.parseInt(countResult[0]?.total || "0")

    const notifications = await dataQuery

    return {
      success: true,
      notifications: notifications as NotificationHistoryItem[],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  } catch (error) {
    console.error("getNotificationHistory: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération de l'historique",
    }
  }
}

export async function getNotificationDetail(notificationId: number) {
  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  const userIsAdmin = await isUserAdmin()
  if (!userIsAdmin) {
    return { success: false, error: "Accès refusé - Réservé aux admins" }
  }

  try {
    const result = await sql`
      SELECT 
        n.*,
        u.first_name || ' ' || u.last_name as user_name,
        sender.first_name || ' ' || sender.last_name as sent_by_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN users sender ON n.sent_by = sender.id
      WHERE n.id = ${notificationId}
    `

    if (result.length === 0) {
      return { success: false, error: "Notification introuvable" }
    }

    return {
      success: true,
      notification: result[0] as NotificationHistoryItem,
    }
  } catch (error) {
    console.error("getNotificationDetail: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération des détails",
    }
  }
}

export async function getNotificationErrorsCount() {
  try {
    const session = await getSession()
    if (!session) {
      return 0
    }

    const userIsAdmin = await isUserAdmin()
    if (!userIsAdmin) {
      return 0
    }

    const result = await sql`
      SELECT COUNT(*) as error_count
      FROM notifications
      WHERE (channels_failed IS NOT NULL AND array_length(channels_failed, 1) > 0)
        AND (error_acknowledged IS NULL OR error_acknowledged = false)
    `

    const count = Number.parseInt(result[0]?.error_count || "0")
    return count
  } catch (error) {
    // Silently return 0 on error - this function runs during layout render
    // and shouldn't break the page if the database is temporarily unavailable
    return 0
  }
}

export async function acknowledgeNotificationError(notificationId: number) {
  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  const userIsAdmin = await isUserAdmin()
  if (!userIsAdmin) {
    return { success: false, error: "Accès refusé - Réservé aux admins" }
  }

  try {
    const updateResult = await sql`
      UPDATE notifications
      SET error_acknowledged = true
      WHERE id = ${notificationId}
    `

    // Revalidate paths to refresh the UI
    revalidatePath("/dashboard/settings/notification-history")
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard")

    // Log the action in audit logs
    await createAuditLog({
      userId: session.id,
      actionType: "NOTIFICATION_ERROR_ACKNOWLEDGED",
      tableName: "notifications",
      recordId: notificationId,
      description: `Admin a marqué l'erreur d'envoi de la notification ${notificationId} comme prise en compte`,
    })

    return { success: true, message: "Erreur marquée comme prise en compte" }
  } catch (error) {
    console.error("[v0] acknowledgeNotificationError: Error", error)
    return {
      success: false,
      error: "Erreur lors de la mise à jour",
    }
  }
}
