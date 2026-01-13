"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { isUserAdmin } from "@/app/actions/admin"

export interface NotificationRecipient {
  user_id: number
  user_name: string
  channels_sent: string[] | null
  channels_failed: string[] | null
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
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed
              ) ORDER BY u.last_name, u.first_name
            ) as recipients
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          GROUP BY n.type, n.related_id
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        // Only delivery status filter
        countQuery = sql`
          SELECT COUNT(*) as total FROM (
            SELECT type, related_id
            FROM notifications
            WHERE delivery_status = ${deliveryStatus}
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
                'channels_failed', n.channels_failed
              ) ORDER BY u.last_name, u.first_name
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
                'channels_failed', n.channels_failed
              ) ORDER BY u.last_name, u.first_name
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
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'user_id', n.user_id,
                'user_name', u.first_name || ' ' || u.last_name,
                'channels_sent', n.channels_sent,
                'channels_failed', n.channels_failed
              ) ORDER BY u.last_name, u.first_name
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
