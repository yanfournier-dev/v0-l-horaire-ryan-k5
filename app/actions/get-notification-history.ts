"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"

export interface NotificationHistoryItem {
  id: number
  user_id: number
  user_name: string
  title: string
  message: string
  type: string
  related_id: number | null
  related_type: string | null
  delivery_status: string | null
  channels_sent: string[] | null
  channels_failed: string[] | null
  error_message: string | null
  sent_by: number | null
  sent_by_name: string | null
  created_at: string
  read: boolean
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
  console.log("[v0] getNotificationHistory: Starting with filters", filters)

  const session = await getSession()
  if (!session) {
    console.log("[v0] getNotificationHistory: No session")
    return { success: false, error: "Non authentifié" }
  }

  if (session.role !== "captain") {
    console.log("[v0] getNotificationHistory: User not captain")
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
        countQuery = sql`SELECT COUNT(*) as total FROM notifications n`
        dataQuery = sql`
          SELECT 
            n.*,
            u.first_name || ' ' || u.last_name as user_name,
            sender.first_name || ' ' || sender.last_name as sent_by_name
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          ORDER BY n.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        // Only delivery status filter
        countQuery = sql`
          SELECT COUNT(*) as total 
          FROM notifications n 
          WHERE n.delivery_status = ${deliveryStatus}
        `
        dataQuery = sql`
          SELECT 
            n.*,
            u.first_name || ' ' || u.last_name as user_name,
            sender.first_name || ' ' || sender.last_name as sent_by_name
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.delivery_status = ${deliveryStatus}
          ORDER BY n.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }
    } else {
      if (!deliveryStatus || deliveryStatus === "all") {
        // Only type filter
        countQuery = sql`
          SELECT COUNT(*) as total 
          FROM notifications n 
          WHERE n.type = ${type}
        `
        dataQuery = sql`
          SELECT 
            n.*,
            u.first_name || ' ' || u.last_name as user_name,
            sender.first_name || ' ' || sender.last_name as sent_by_name
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.type = ${type}
          ORDER BY n.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        // Both type and delivery status filters
        countQuery = sql`
          SELECT COUNT(*) as total 
          FROM notifications n 
          WHERE n.type = ${type} AND n.delivery_status = ${deliveryStatus}
        `
        dataQuery = sql`
          SELECT 
            n.*,
            u.first_name || ' ' || u.last_name as user_name,
            sender.first_name || ' ' || sender.last_name as sent_by_name
          FROM notifications n
          LEFT JOIN users u ON n.user_id = u.id
          LEFT JOIN users sender ON n.sent_by = sender.id
          WHERE n.type = ${type} AND n.delivery_status = ${deliveryStatus}
          ORDER BY n.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }
    }

    // Additional filters for start date and end date
    if (startDate) {
      countQuery = sql`${countQuery} AND n.created_at >= ${startDate}`
      dataQuery = sql`${dataQuery} AND n.created_at >= ${startDate}`
    }
    if (endDate) {
      countQuery = sql`${countQuery} AND n.created_at <= ${endDate}`
      dataQuery = sql`${dataQuery} AND n.created_at <= ${endDate}`
    }

    console.log("[v0] Executing count and data queries")
    const countResult = await countQuery
    const totalCount = Number.parseInt(countResult[0]?.total || "0")

    const notifications = await dataQuery

    console.log(`[v0] getNotificationHistory: Found ${notifications.length} notifications`)

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
    console.error("[v0] getNotificationHistory: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération de l'historique",
    }
  }
}

export async function getNotificationDetail(notificationId: number) {
  console.log("[v0] getNotificationDetail: Starting", notificationId)

  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  if (session.role !== "captain") {
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

    console.log("[v0] getNotificationDetail: Found notification")

    return {
      success: true,
      notification: result[0] as NotificationHistoryItem,
    }
  } catch (error) {
    console.error("[v0] getNotificationDetail: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération des détails",
    }
  }
}
