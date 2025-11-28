"use server"

import { neon } from "@neondatabase/serverless"
import { headers } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export type AuditActionType =
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_DELETED"
  | "SECOND_REPLACEMENT_ADDED"
  | "REPLACEMENT_CREATED"
  | "REPLACEMENT_APPROVED"
  | "REPLACEMENT_REJECTED"
  | "REPLACEMENT_ASSIGNED"
  | "EXCHANGE_CREATED"
  | "EXCHANGE_APPROVED"
  | "EXCHANGE_REJECTED"
  | "LEAVE_CREATED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_UPDATED"
  | "LEAVE_DELETED"

interface AuditLogParams {
  userId: number
  actionType: AuditActionType
  tableName?: string
  recordId?: number
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  description: string
}

/**
 * Fonction principale pour créer un log d'audit
 * Utilisée partout dans l'application pour tracer les actions importantes
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const headersList = await headers()
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null

    await sql`
      INSERT INTO audit_logs (
        user_id,
        action_type,
        table_name,
        record_id,
        old_values,
        new_values,
        description,
        ip_address
      ) VALUES (
        ${params.userId},
        ${params.actionType},
        ${params.tableName || null},
        ${params.recordId || null},
        ${params.oldValues ? JSON.stringify(params.oldValues) : null},
        ${params.newValues ? JSON.stringify(params.newValues) : null},
        ${params.description},
        ${ipAddress}
      )
    `

    console.log("[v0] Audit log created:", params.actionType, "by user", params.userId)
  } catch (error) {
    console.error("[v0] Error creating audit log:", error)
    // Ne pas faire échouer l'opération principale si le logging échoue
  }
}

/**
 * Récupérer les logs d'audit avec pagination et filtres
 */
export async function getAuditLogs(options: {
  page?: number
  limit?: number
  userId?: number
  actionType?: AuditActionType
  startDate?: string
  endDate?: string
}) {
  const page = options.page || 1
  const limit = options.limit || 50
  const offset = (page - 1) * limit

  try {
    const whereConditions = []
    const params: any[] = []

    if (options.userId) {
      whereConditions.push(`user_id = $${params.length + 1}`)
      params.push(options.userId)
    }

    if (options.actionType) {
      whereConditions.push(`action_type = $${params.length + 1}`)
      params.push(options.actionType)
    }

    if (options.startDate) {
      whereConditions.push(`created_at >= $${params.length + 1}`)
      params.push(options.startDate)
    }

    if (options.endDate) {
      whereConditions.push(`created_at <= $${params.length + 1}`)
      params.push(options.endDate)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    // Compter le total
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM audit_logs
      ${whereClause ? sql.unsafe(whereClause) : sql``}
    `

    const total = Number.parseInt(countResult[0]?.total || "0")

    // Récupérer les logs avec les informations de l'utilisateur
    const logs = await sql`
      SELECT 
        al.id,
        al.user_id,
        al.action_type,
        al.table_name,
        al.record_id,
        al.old_values,
        al.new_values,
        al.description,
        al.ip_address,
        (al.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto') as created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause ? sql.unsafe(whereClause) : sql``}
      ORDER BY al.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    console.error("[v0] Error fetching audit logs:", error)
    throw new Error("Erreur lors de la récupération des logs d'audit")
  }
}

/**
 * Nettoyer les logs de plus d'1 an
 * Cette fonction peut être appelée par un cron job
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  try {
    const result = await sql`
      DELETE FROM audit_logs
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
      RETURNING id
    `

    console.log(`[v0] Cleaned up ${result.length} old audit logs`)
    return result.length
  } catch (error) {
    console.error("[v0] Error cleaning up old audit logs:", error)
    throw new Error("Erreur lors du nettoyage des anciens logs")
  }
}
