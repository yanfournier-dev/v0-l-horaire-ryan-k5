"use server"

import { sql, invalidateCache } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/app/actions/notifications"
import { parseLocalDate } from "@/lib/calendar"
import { createAuditLog } from "./audit"
import { checkConsecutiveHours } from "@/lib/consecutive-hours"

export async function checkExchangeTablesExist() {
  try {
    console.log("[v0] Checking if exchange tables exist...")
    const result = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('shift_exchanges', 'user_exchange_counts')
    `

    console.log("[v0] Table check result:", result)
    console.log("[v0] Count value:", result[0].count)
    console.log("[v0] Count type:", typeof result[0].count)

    const count = Number(result[0].count)
    const exists = count === 2
    console.log("[v0] Tables exist:", exists)

    // Both tables should exist (count = 2)
    return { exists }
  } catch (error: any) {
    console.error("[v0] Error checking tables:", error)
    return { exists: false }
  }
}

export async function getUserShiftsForExchange(userId: number, selectedDate?: string) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non autorisé" }
    }

    console.log("[v0] getUserShiftsForExchange called with userId:", userId, "selectedDate:", selectedDate)

    if (selectedDate) {
      // Get cycle configuration
      const cycleConfig = await sql`
        SELECT start_date, cycle_length_days
        FROM cycle_config
        WHERE is_active = true
        LIMIT 1
      `

      if (cycleConfig.length === 0) {
        return { error: "Configuration du cycle non trouvée" }
      }

      const { start_date, cycle_length_days } = cycleConfig[0]

      const selectedDateObj = parseLocalDate(selectedDate)
      const startDateObj = parseLocalDate(start_date)
      const diffTime = selectedDateObj.getTime() - startDateObj.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const cycleDay = (diffDays % cycle_length_days) + 1

      console.log("[v0] Calculated cycle_day:", cycleDay, "for date:", selectedDate)

      // Get user's shifts for this cycle day based on team membership
      const shifts = await sql`
        SELECT DISTINCT
          s.id,
          s.shift_type,
          s.team_id,
          t.name as team_name,
          s.cycle_day,
          s.start_time,
          s.end_time
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN shifts s ON s.team_id = t.id
        WHERE tm.user_id = ${userId}
        AND s.cycle_day = ${cycleDay}
        ORDER BY s.shift_type
      `

      console.log("[v0] Found shifts for cycle_day", cycleDay, ":", shifts.length, shifts)

      return { shifts }
    } else {
      // Get all user's shifts based on team membership
      const shifts = await sql`
        SELECT DISTINCT
          s.id,
          s.shift_type,
          s.team_id,
          t.name as team_name,
          s.cycle_day,
          s.start_time,
          s.end_time
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN shifts s ON s.team_id = t.id
        WHERE tm.user_id = ${userId}
        ORDER BY s.cycle_day, s.shift_type
      `

      console.log("[v0] Found all shifts:", shifts.length, shifts)

      return { shifts }
    }
  } catch (error) {
    console.error("[v0] Error getting user shifts:", error)
    return { error: "Erreur lors de la récupération des quarts" }
  }
}

export async function getAvailableFirefightersForExchange(
  requesterId: number,
  targetDate: string,
  targetShiftType: string,
) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non autorisé" }
    }

    console.log(
      "[v0] getAvailableFirefightersForExchange called with requesterId:",
      requesterId,
      "targetDate:",
      targetDate,
      "targetShiftType:",
      targetShiftType,
    )

    // Get cycle configuration
    const cycleConfig = await sql`
      SELECT start_date, cycle_length_days
      FROM cycle_config
      WHERE is_active = true
      LIMIT 1
    `

    if (cycleConfig.length === 0) {
      return { error: "Configuration du cycle non trouvée" }
    }

    const { start_date, cycle_length_days } = cycleConfig[0]

    const targetDateObj = parseLocalDate(targetDate)
    const startDateObj = parseLocalDate(start_date)
    const diffTime = targetDateObj.getTime() - startDateObj.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const cycleDay = (diffDays % cycle_length_days) + 1

    console.log("[v0] Calculated cycle_day:", cycleDay, "for target date:", targetDate)

    const requesterTeams = await sql`
      SELECT team_id
      FROM team_members
      WHERE user_id = ${requesterId}
    `

    const requesterTeamIds = requesterTeams.map((t: any) => t.team_id)
    console.log("[v0] Requester team IDs:", requesterTeamIds)

    const firefighters = await sql`
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        t.name as team_name,
        t.id as team_id,
        s.shift_type,
        s.start_time,
        s.end_time
      FROM users u
      JOIN team_members tm ON u.id = tm.user_id
      JOIN teams t ON tm.team_id = t.id
      JOIN shifts s ON s.team_id = t.id
      WHERE u.id != ${requesterId}
      AND s.cycle_day = ${cycleDay}
      AND NOT (t.id = ANY(${requesterTeamIds}))
      ORDER BY t.name, u.last_name, u.first_name
    `

    console.log("[v0] Found available firefighters:", firefighters.length, firefighters)

    return { firefighters }
  } catch (error) {
    console.error("[v0] Error getting available firefighters:", error)
    return { error: "Erreur lors de la récupération des pompiers" }
  }
}

export async function createExchangeRequest(data: {
  targetId: number
  requesterShiftDate: string
  requesterShiftType: string
  requesterTeamId: number
  targetShiftDate: string
  targetShiftType: string
  targetTeamId: number
  isPartial: boolean
  requesterStartTime?: string
  requesterEndTime?: string
  targetStartTime?: string
  targetEndTime?: string
}) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non autorisé" }
    }

    const requesterShiftYear = new Date(data.requesterShiftDate).getFullYear()
    const exchangeCountResult = await getUserExchangeCount(user.id, requesterShiftYear)
    const count = exchangeCountResult.count || 0

    let warning = undefined
    if (count >= 8) {
      warning = `Attention: Vous avez déjà ${count} échanges approuvés pour l'année ${requesterShiftYear}. La limite recommandée est de 8 échanges par année.`
    }

    // Create the exchange request
    const result = await sql`
      INSERT INTO shift_exchanges (
        requester_id,
        target_id,
        requester_shift_date,
        requester_shift_type,
        requester_team_id,
        target_shift_date,
        target_shift_type,
        target_team_id,
        is_partial,
        requester_start_time,
        requester_end_time,
        target_start_time,
        target_end_time
      ) VALUES (
        ${user.id},
        ${data.targetId},
        ${data.requesterShiftDate},
        ${data.requesterShiftType},
        ${data.requesterTeamId},
        ${data.targetShiftDate},
        ${data.targetShiftType},
        ${data.targetTeamId},
        ${data.isPartial},
        ${data.requesterStartTime || null},
        ${data.requesterEndTime || null},
        ${data.targetStartTime || null},
        ${data.targetEndTime || null}
      )
      RETURNING id
    `

    const exchangeId = result[0].id

    try {
      const targetUser = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id = ${data.targetId}
      `

      if (targetUser.length > 0) {
        const requesterPartialHours =
          data.isPartial && data.requesterStartTime && data.requesterEndTime
            ? `${data.requesterStartTime.slice(0, 5)} - ${data.requesterEndTime.slice(0, 5)}`
            : ""

        const targetPartialHours =
          data.isPartial && data.targetStartTime && data.targetEndTime
            ? `${data.targetStartTime.slice(0, 5)} - ${data.targetEndTime.slice(0, 5)}`
            : ""

        const requesterShiftDate = new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const targetShiftDate = new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        await createAuditLog({
          userId: user.id,
          actionType: "EXCHANGE_CREATED",
          tableName: "shift_exchanges",
          recordId: exchangeId,
          description: `Échange créé: ${user.first_name} ${user.last_name} propose à ${targetUser[0].first_name} ${targetUser[0].last_name} (${data.requesterShiftDate} ↔ ${data.targetShiftDate})`,
          newValues: data,
        })

        await createNotification(
          data.targetId,
          "Nouvelle demande d'échange de quart",
          `${user.first_name} ${user.last_name} vous propose un échange de quart: ${requesterShiftDate} (${data.requesterShiftType}) contre ${targetShiftDate} (${data.targetShiftType})${data.isPartial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
          "exchange_request",
          exchangeId,
          "shift_exchange",
        )

        await createNotification(
          user.id,
          "Demande d'échange envoyée",
          `Votre demande d'échange avec ${targetUser[0].first_name} ${targetUser[0].last_name} a été envoyée: ${requesterShiftDate} (${data.requesterShiftType}) contre ${targetShiftDate} (${data.targetShiftType})${data.isPartial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
          "exchange_request_confirmation",
          exchangeId,
          "shift_exchange",
        )
      }
    } catch (notificationError) {
      console.error("[v0] Error sending exchange request notifications:", notificationError)
    }

    revalidatePath("/dashboard/exchanges")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true, warning }
  } catch (error) {
    console.error("[v0] Error creating exchange request:", error)
    return { error: "Erreur lors de la création de la demande d'échange" }
  }
}

export async function getUserExchanges(userId: number) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non autorisé" }
    }

    const exchanges = await sql`
      SELECT 
        se.*,
        req.first_name as requester_first_name,
        req.last_name as requester_last_name,
        tgt.first_name as target_first_name,
        tgt.last_name as target_last_name,
        req_team.name as requester_team_name,
        tgt_team.name as target_team_name,
        approver.first_name as approver_first_name,
        approver.last_name as approver_last_name
      FROM shift_exchanges se
      JOIN users req ON se.requester_id = req.id
      JOIN users tgt ON se.target_id = tgt.id
      JOIN teams req_team ON se.requester_team_id = req_team.id
      JOIN teams tgt_team ON se.target_team_id = tgt_team.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE (se.requester_id = ${userId} OR se.target_id = ${userId})
      AND se.status != 'cancelled'
      ORDER BY se.created_at DESC
    `

    return { exchanges }
  } catch (error: any) {
    console.error("[v0] Error getting user exchanges:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)

    if (error.message?.includes("Too Many") || error.message?.includes("rate limit")) {
      return { error: "Trop de requêtes. Veuillez patienter quelques secondes et réessayer." }
    }

    return { error: "Erreur lors de la récupération des échanges" }
  }
}

export async function getPendingExchanges() {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    const exchanges = await sql`
      SELECT 
        se.*,
        req.first_name as requester_first_name,
        req.last_name as requester_last_name,
        tgt.first_name as target_first_name,
        tgt.last_name as target_last_name,
        req_team.name as requester_team_name,
        tgt_team.name as target_team_name
      FROM shift_exchanges se
      JOIN users req ON se.requester_id = req.id
      JOIN users tgt ON se.target_id = tgt.id
      JOIN teams req_team ON se.requester_team_id = req_team.id
      JOIN teams tgt_team ON se.target_team_id = tgt_team.id
      WHERE se.status = 'pending'
      ORDER BY se.created_at ASC
    `

    return { exchanges }
  } catch (error: any) {
    console.error("[v0] Error getting pending exchanges:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)

    if (error.message?.includes("Too Many") || error.message?.includes("rate limit")) {
      return { error: "Trop de requêtes. Veuillez patienter quelques secondes et réessayer." }
    }

    return { error: "Erreur lors de la récupération des échanges en attente" }
  }
}

export async function getUserExchangeCount(userId: number, year?: number) {
  try {
    const targetYear = year || new Date().getFullYear()

    const result = await sql`
      SELECT COUNT(*) as exchange_count
      FROM shift_exchanges
      WHERE requester_id = ${userId}
      AND status = 'approved'
      AND EXTRACT(YEAR FROM requester_shift_date) = ${targetYear}
    `

    return { count: result.length > 0 ? Number.parseInt(result[0].exchange_count) : 0 }
  } catch (error: any) {
    console.error("[v0] Error getting exchange count:", error)

    if (error.message?.includes("Too Many") || error.message?.includes("rate limit")) {
      return { count: 0, error: "Trop de requêtes. Veuillez patienter quelques secondes." }
    }

    if (error.message?.includes("does not exist")) {
      return { count: 0, tablesMissing: true }
    }
    return { count: 0 }
  }
}

export async function approveExchange(exchangeId: number, forceConsecutiveHours = false) {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    // Get exchange details
    const exchanges = await sql`
      SELECT * FROM shift_exchanges
      WHERE id = ${exchangeId}
      AND status = 'pending'
    `

    if (exchanges.length === 0) {
      return { error: "Échange non trouvé ou déjà traité" }
    }

    const exchange = exchanges[0]

    const requesterShiftYear = new Date(exchange.requester_shift_date).getFullYear()
    const exchangeCountResult = await getUserExchangeCount(exchange.requester_id, requesterShiftYear)
    const count = exchangeCountResult.count || 0

    let warning = undefined
    if (count >= 8) {
      warning = `Attention: Le pompier a déjà ${count} échanges approuvés pour l'année ${requesterShiftYear}. La limite recommandée est de 8 échanges par année.`
    }

    console.log("[v0] Approving exchange:", exchangeId, exchange)

    if (!forceConsecutiveHours) {
      console.log("[v0] Checking consecutive hours for exchange approval")

      const requesterShiftDateStr = new Date(exchange.target_shift_date).toISOString().split("T")[0]
      const targetShiftDateStr = new Date(exchange.requester_shift_date).toISOString().split("T")[0]

      // Check requester (taking target's shift)
      const requesterCheck = await checkConsecutiveHours(
        exchange.requester_id,
        requesterShiftDateStr,
        exchange.target_shift_type,
      )

      if (requesterCheck.exceeds) {
        const users = await sql`SELECT first_name, last_name FROM users WHERE id = ${exchange.requester_id}`
        const userName = users.length > 0 ? `${users[0].first_name} ${users[0].last_name}` : "Le pompier"

        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: `${userName} travaillerait ${requesterCheck.totalHours.toFixed(1)}h consécutives en prenant ce quart, ce qui dépasse la limite de 38h.`,
          maxHours: requesterCheck.totalHours,
          userId: exchange.requester_id,
        }
      }

      // Check target (taking requester's shift)
      const targetCheck = await checkConsecutiveHours(
        exchange.target_id,
        targetShiftDateStr,
        exchange.requester_shift_type,
      )

      if (targetCheck.exceeds) {
        const users = await sql`SELECT first_name, last_name FROM users WHERE id = ${exchange.target_id}`
        const userName = users.length > 0 ? `${users[0].first_name} ${users[0].last_name}` : "Le pompier"

        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: `${userName} travaillerait ${targetCheck.totalHours.toFixed(1)}h consécutives en prenant ce quart, ce qui dépasse la limite de 38h.`,
          maxHours: targetCheck.totalHours,
          userId: exchange.target_id,
        }
      }

      console.log("[v0] Consecutive hours check passed for both firefighters")
    } else {
      console.log("[v0] Consecutive hours check bypassed (forced approval)")
    }

    // Start transaction
    await sql`BEGIN`

    try {
      // Update exchange status
      await sql`
        UPDATE shift_exchanges
        SET 
          status = 'approved',
          approved_by = ${user.id},
          approved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${exchangeId}
      `

      // Find requester's shift
      const requesterShifts = await sql`
        SELECT id FROM shifts
        WHERE team_id = ${exchange.requester_team_id}
        AND shift_type = ${exchange.requester_shift_type}
        LIMIT 1
      `

      if (requesterShifts.length === 0) {
        await sql`ROLLBACK`
        return { error: "Impossible de trouver le quart du demandeur" }
      }

      const requesterShiftId = requesterShifts[0].id

      // Find target's shift
      const targetShifts = await sql`
        SELECT id FROM shifts
        WHERE team_id = ${exchange.target_team_id}
        AND shift_type = ${exchange.target_shift_type}
        LIMIT 1
      `

      if (targetShifts.length === 0) {
        await sql`ROLLBACK`
        return { error: "Impossible de trouver le quart de la cible" }
      }

      const targetShiftId = targetShifts[0].id

      console.log("[v0] Requester shift_id:", requesterShiftId, "Target shift_id:", targetShiftId)

      await sql`
        DELETE FROM shift_assignments
        WHERE (shift_id = ${requesterShiftId} AND user_id IN (${exchange.requester_id}, ${exchange.target_id}))
        OR (shift_id = ${targetShiftId} AND user_id IN (${exchange.requester_id}, ${exchange.target_id}))
      `

      console.log("[v0] Deleted all conflicting assignments")

      await sql`
        INSERT INTO shift_assignments (user_id, shift_id, is_extra, is_partial, start_time, end_time)
        VALUES 
          (${exchange.target_id}, ${requesterShiftId}, false, ${exchange.is_partial}, ${exchange.requester_start_time || null}, ${exchange.requester_end_time || null}),
          (${exchange.requester_id}, ${targetShiftId}, false, ${exchange.is_partial}, ${exchange.target_start_time || null}, ${exchange.target_end_time || null})
      `

      console.log("[v0] Created swapped assignments")

      await sql`
        INSERT INTO user_exchange_counts (user_id, year, exchange_count)
        VALUES (${exchange.requester_id}, ${requesterShiftYear}, 1)
        ON CONFLICT (user_id, year)
        DO UPDATE SET 
          exchange_count = user_exchange_counts.exchange_count + 1,
          updated_at = NOW()
      `

      await sql`COMMIT`

      console.log("[v0] Exchange approved successfully:", exchangeId)

      const users = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
      `

      const requesterUser = users.find((u: any) => u.id === exchange.requester_id)
      const targetUser = users.find((u: any) => u.id === exchange.target_id)

      await createAuditLog({
        userId: user.id,
        actionType: "EXCHANGE_APPROVED",
        tableName: "shift_exchanges",
        recordId: exchangeId,
        description: `Échange approuvé: ${requesterUser?.first_name} ${requesterUser?.last_name} ↔ ${targetUser?.first_name} ${targetUser?.last_name} (${exchange.requester_shift_date} ↔ ${exchange.target_shift_date})`,
      })

      // Send notifications
      try {
        const users = await sql`
          SELECT id, email, first_name, last_name
          FROM users
          WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
        `

        const requesterUser = users.find((u: any) => u.id === exchange.requester_id)
        const targetUser = users.find((u: any) => u.id === exchange.target_id)

        const requesterPartialHours =
          exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time
            ? `${exchange.requester_start_time.slice(0, 5)} - ${exchange.requester_end_time.slice(0, 5)}`
            : ""

        const targetPartialHours =
          exchange.is_partial && exchange.target_start_time && exchange.targetEndTime
            ? `${exchange.target_start_time.slice(0, 5)} - ${exchange.targetEndTime.slice(0, 5)}`
            : ""

        const requesterShiftDate = new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const targetShiftDate = new Date(exchange.target_shift_date).toLocaleDateString("fr-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        if (requesterUser) {
          await createNotification(
            requesterUser.id,
            "✅ Échange de quart approuvé",
            `Votre échange de quart avec ${targetUser.first_name} ${targetUser.last_name} a été approuvé: ${requesterShiftDate} (${exchange.requester_shift_type}) contre ${targetShiftDate} (${exchange.target_shift_type})${exchange.is_partial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
            "exchange_approved",
            exchangeId,
            "shift_exchange",
          )
        }

        if (targetUser) {
          await createNotification(
            targetUser.id,
            "✅ Échange de quart approuvé",
            `Votre échange de quart avec ${requesterUser.first_name} ${requesterUser.last_name} a été approuvé: ${targetShiftDate} (${exchange.target_shift_type}) contre ${requesterShiftDate} (${exchange.requester_shift_type})${exchange.is_partial ? ` - Partiel: ${targetPartialHours} / ${requesterPartialHours}` : ""}`,
            "exchange_approved",
            exchangeId,
            "shift_exchange",
          )
        }
      } catch (notificationError) {
        console.error("[v0] Error sending approval notifications:", notificationError)
      }

      revalidatePath("/dashboard/exchanges")
      revalidatePath("/dashboard/calendar")

      try {
        invalidateCache()
      } catch (cacheError) {
        console.error("[v0] Error invalidating cache:", cacheError)
      }

      return { success: true, warning }
    } catch (error) {
      await sql`ROLLBACK`
      console.error("[v0] Error in transaction:", error)
      return { error: "Erreur lors de l'approbation de l'échange" }
    }
  } catch (error) {
    console.error("[v0] Error approving exchange:", error)
    return { error: "Erreur lors de l'approbation de l'échange" }
  }
}

export async function rejectExchange(exchangeId: number, reason?: string) {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    const exchanges = await sql`
      SELECT * FROM shift_exchanges
      WHERE id = ${exchangeId}
      AND status = 'pending'
    `

    if (exchanges.length === 0) {
      return { error: "Échange non trouvé ou déjà traité" }
    }

    const exchange = exchanges[0]

    await sql`
      UPDATE shift_exchanges
      SET 
        status = 'rejected',
        rejected_reason = ${reason || null},
        approved_by = ${user.id},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${exchangeId}
      AND status = 'pending'
    `

    console.log("[v0] Exchange rejected:", exchangeId)

    const users = await sql`
      SELECT id, email, first_name, last_name
      FROM users
      WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
    `

    const requesterUser = users.find((u: any) => u.id === exchange.requester_id)
    const targetUser = users.find((u: any) => u.id === exchange.target_id)

    await createAuditLog({
      userId: user.id,
      actionType: "EXCHANGE_REJECTED",
      tableName: "shift_exchanges",
      recordId: exchangeId,
      description: `Échange rejeté: ${requesterUser?.first_name} ${requesterUser?.last_name} ↔ ${targetUser?.first_name} ${targetUser?.last_name}${reason ? ` - Raison: ${reason}` : ""}`,
    })

    // Send notifications
    try {
      const users = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
      `

      const requesterUser = users.find((u: any) => u.id === exchange.requester_id)
      const targetUser = users.find((u: any) => u.id === exchange.target_id)

      const requesterPartialHours =
        exchange.is_partial && exchange.requester_start_time && exchange.requesterEndTime
          ? `${exchange.requester_start_time.slice(0, 5)} - ${exchange.requesterEndTime.slice(0, 5)}`
          : ""

      const targetPartialHours =
        exchange.is_partial && exchange.target_start_time && exchange.targetEndTime
          ? `${exchange.target_start_time.slice(0, 5)} - ${exchange.targetEndTime.slice(0, 5)}`
          : ""

      const requesterShiftDate = new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      const targetShiftDate = new Date(exchange.target_shift_date).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      if (requesterUser) {
        await createNotification(
          requesterUser.id,
          "❌ Échange de quart refusé",
          `Votre demande d'échange avec ${targetUser.first_name} ${targetUser.last_name} a été refusée: ${requesterShiftDate} (${exchange.requester_shift_type}) contre ${targetShiftDate} (${exchange.target_shift_type})${reason ? ` - Raison: ${reason}` : ""}${exchange.is_partial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
          "exchange_rejected",
          exchangeId,
          "shift_exchange",
        )
      }

      if (targetUser) {
        await createNotification(
          targetUser.id,
          "❌ Échange de quart refusé",
          `La demande d'échange avec ${requesterUser.first_name} ${requesterUser.last_name} a été refusée: ${targetShiftDate} (${exchange.target_shift_type}) contre ${requesterShiftDate} (${exchange.requester_shift_type})${reason ? ` - Raison: ${reason}` : ""}${exchange.is_partial ? ` - Partiel: ${targetPartialHours} / ${requesterPartialHours}` : ""}`,
          "exchange_rejected",
          exchangeId,
          "shift_exchange",
        )
      }
    } catch (notificationError) {
      console.error("[v0] Error sending rejection notification:", notificationError)
    }

    revalidatePath("/dashboard/exchanges")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error rejecting exchange:", error)
    return { error: "Erreur lors du rejet de l'échange" }
  }
}

export async function cancelExchangeRequest(exchangeId: number) {
  try {
    const user = await getSession()
    if (!user) {
      return { error: "Non autorisé" }
    }

    // Get exchange details
    const exchanges = await sql`
      SELECT * FROM shift_exchanges
      WHERE id = ${exchangeId}
    `

    if (exchanges.length === 0) {
      return { error: "Demande d'échange non trouvée" }
    }

    const exchange = exchanges[0]

    const users = await sql`
      SELECT id, first_name, last_name
      FROM users
      WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
    `

    const requester = users.find((u: any) => u.id === exchange.requester_id)
    const target = users.find((u: any) => u.id === exchange.target_id)

    if (!user.is_admin) {
      if (exchange.requester_id !== user.id) {
        return { error: "Vous n'êtes pas autorisé à annuler cette demande" }
      }
      if (exchange.status !== "pending") {
        return { error: "Vous ne pouvez annuler que les demandes en attente" }
      }
    }

    if (exchange.status === "approved" && user.is_admin) {
      await sql`BEGIN`

      try {
        // Find the swapped assignments
        const requesterAssignments = await sql`
          SELECT sa.id, sa.shift_id
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE sa.user_id = ${exchange.target_id}
          AND s.team_id = ${exchange.requester_team_id}
          AND s.shift_type = ${exchange.requester_shift_type}
          AND NOT sa.is_extra
          LIMIT 1
        `

        const targetAssignments = await sql`
          SELECT sa.id, sa.shift_id
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE sa.user_id = ${exchange.requester_id}
          AND s.team_id = ${exchange.target_team_id}
          AND s.shift_type = ${exchange.target_shift_type}
          AND NOT sa.is_extra
          LIMIT 1
        `

        if (requesterAssignments.length > 0 && targetAssignments.length > 0) {
          const requesterShiftId = requesterAssignments[0].shift_id
          const targetShiftId = targetAssignments[0].shift_id

          // Delete the swapped assignments
          await sql`
            DELETE FROM shift_assignments
            WHERE id IN (${requesterAssignments[0].id}, ${targetAssignments[0].id})
          `

          // Recreate original assignments with ON CONFLICT to handle existing assignments
          await sql`
            INSERT INTO shift_assignments (user_id, shift_id, is_extra, is_partial, start_time, end_time)
            VALUES 
              (${exchange.requester_id}, ${requesterShiftId}, false, false, NULL, NULL),
              (${exchange.target_id}, ${targetShiftId}, false, false, NULL, NULL)
            ON CONFLICT (shift_id, user_id) DO UPDATE SET
              is_extra = false,
              is_partial = false,
              start_time = NULL,
              end_time = NULL
          `

          const requesterShiftYear = new Date(exchange.requester_shift_date).getFullYear()
          await sql`
            UPDATE user_exchange_counts
            SET 
              exchange_count = GREATEST(0, exchange_count - 1)
            WHERE user_id = ${exchange.requester_id}
            AND year = ${requesterShiftYear}
          `
        }

        // Update exchange status to cancelled
        await sql`
          UPDATE shift_exchanges
          SET 
            status = 'cancelled'
          WHERE id = ${exchangeId}
        `

        await sql`COMMIT`
        console.log("[v0] Approved exchange deleted and reverted:", exchangeId, "by admin:", user.id)

        await createAuditLog({
          userId: user.id,
          actionType: "EXCHANGE_APPROVED_CANCELLED",
          tableName: "shift_exchanges",
          recordId: exchangeId,
          description: `Échange approuvé annulé: ${requester?.first_name} ${requester?.last_name} ↔ ${target?.first_name} ${target?.last_name} (${new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA")})`,
          oldValues: { status: "approved" },
          newValues: { status: "cancelled" },
        })
      } catch (error) {
        await sql`ROLLBACK`
        console.error("[v0] Error reverting approved exchange:", error)
        return { error: "Erreur lors de l'annulation de l'échange approuvé" }
      }
    } else {
      // Simple cancellation for pending exchanges
      await sql`
        UPDATE shift_exchanges
        SET 
          status = 'cancelled'
        WHERE id = ${exchangeId}
      `

      console.log("[v0] Exchange request cancelled:", exchangeId, "by user:", user.id)

      await createAuditLog({
        userId: user.id,
        actionType: "EXCHANGE_CANCELLED",
        tableName: "shift_exchanges",
        recordId: exchangeId,
        description: `Demande d'échange annulée: ${requester?.first_name} ${requester?.last_name} ↔ ${target?.first_name} ${target?.last_name} (${new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA")})`,
        oldValues: { status: exchange.status },
        newValues: { status: "cancelled" },
      })
    }

    // Optionally notify the users
    try {
      const users = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
      `

      // You could send cancellation emails here if needed
      console.log("[v0] Exchange cancelled - notifying users")
    } catch (emailError) {
      console.error("[v0] Error notifying users:", emailError)
    }

    revalidatePath("/dashboard/exchanges")
    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Error cancelling exchange request:", error)
    return { error: "Erreur lors de l'annulation de la demande d'échange" }
  }
}

export async function getAllExchanges() {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    console.log("[v0] Getting all exchanges for admin (including past exchanges)")

    const exchanges = await sql`
      SELECT 
        se.*,
        req.first_name as requester_first_name,
        req.last_name as requester_last_name,
        tgt.first_name as target_first_name,
        tgt.last_name as target_last_name,
        req_team.name as requester_team_name,
        tgt_team.name as target_team_name,
        approver.first_name as approver_first_name,
        approver.last_name as approver_last_name
      FROM shift_exchanges se
      JOIN users req ON se.requester_id = req.id
      JOIN users tgt ON se.target_id = tgt.id
      JOIN teams req_team ON se.requester_team_id = req_team.id
      JOIN teams tgt_team ON se.target_team_id = tgt_team.id
      LEFT JOIN users approver ON se.approved_by = approver.id
      WHERE se.status != 'cancelled'
      ORDER BY 
        CASE se.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3
        END,
        se.created_at DESC
    `

    console.log("[v0] Found", exchanges.length, "exchanges")

    return { exchanges }
  } catch (error: any) {
    console.error("[v0] Error getting all exchanges:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error stack:", error.stack)
    console.error("[v0] Error name:", error.name)

    if (error.message?.includes("Too Many") || error.message?.includes("rate limit")) {
      return { error: "Trop de requêtes. Veuillez patienter quelques secondes et réessayer." }
    }

    return { error: "Erreur lors de la récupération des échanges" }
  }
}

export async function createExchangeAsAdmin(data: {
  requesterId: number
  targetId: number
  requesterShiftDate: string
  requesterShiftType: string
  requesterTeamId: number
  targetShiftDate: string
  targetShiftType: string
  targetTeamId: number
  isPartial: boolean
  requesterStartTime?: string
  requesterEndTime?: string
  targetStartTime?: string
  targetEndTime?: string
  autoApprove: boolean
  forceConsecutiveHours?: boolean
}) {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    const requesterShiftYear = new Date(data.requesterShiftDate).getFullYear()
    const exchangeCountResult = await getUserExchangeCount(data.requesterId, requesterShiftYear)
    const count = exchangeCountResult.count || 0

    let warning = undefined
    if (count >= 8) {
      warning = `Attention: Le pompier a déjà ${count} échanges approuvés pour l'année ${requesterShiftYear}. La limite recommandée est de 8 échanges par année.`
    }

    if (data.autoApprove && !data.forceConsecutiveHours) {
      console.log("[v0] Checking consecutive hours for admin exchange creation")

      // Check requester (taking target's shift)
      const requesterCheck = await checkConsecutiveHours(data.requesterId, data.targetShiftDate, data.targetShiftType)

      if (requesterCheck.exceeds) {
        const users = await sql`SELECT first_name, last_name FROM users WHERE id = ${data.requesterId}`
        const userName = users.length > 0 ? `${users[0].first_name} ${users[0].last_name}` : "Le pompier"

        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: `${userName} travaillerait ${requesterCheck.totalHours.toFixed(1)}h consécutives en prenant ce quart, ce qui dépasse la limite de 38h.`,
          maxHours: requesterCheck.totalHours,
          userId: data.requesterId,
        }
      }

      // Check target (taking requester's shift)
      const targetCheck = await checkConsecutiveHours(data.targetId, data.requesterShiftDate, data.requesterShiftType)

      if (targetCheck.exceeds) {
        const users = await sql`SELECT first_name, last_name FROM users WHERE id = ${data.targetId}`
        const userName = users.length > 0 ? `${users[0].first_name} ${users[0].last_name}` : "Le pompier"

        return {
          error: "CONSECUTIVE_HOURS_EXCEEDED",
          message: `${userName} travaillerait ${targetCheck.totalHours.toFixed(1)}h consécutives en prenant ce quart, ce qui dépasse la limite de 38h.`,
          maxHours: targetCheck.totalHours,
          userId: data.targetId,
        }
      }

      console.log("[v0] Consecutive hours check passed for both firefighters")
    } else if (data.autoApprove) {
      console.log("[v0] Consecutive hours check bypassed (forced approval)")
    }

    // Create the exchange request
    const result = await sql`
      INSERT INTO shift_exchanges (
        requester_id,
        target_id,
        requester_shift_date,
        requester_shift_type,
        requester_team_id,
        target_shift_date,
        target_shift_type,
        target_team_id,
        is_partial,
        requester_start_time,
        requester_end_time,
        target_start_time,
        target_end_time,
        status,
        approved_by,
        approved_at
      ) VALUES (
        ${data.requesterId},
        ${data.targetId},
        ${data.requesterShiftDate},
        ${data.requesterShiftType},
        ${data.requesterTeamId},
        ${data.targetShiftDate},
        ${data.targetShiftType},
        ${data.targetTeamId},
        ${data.isPartial},
        ${data.requesterStartTime || null},
        ${data.requesterEndTime || null},
        ${data.targetStartTime || null},
        ${data.targetEndTime || null},
        ${data.autoApprove ? "approved" : "pending"},
        ${data.autoApprove ? user.id : null},
        ${data.autoApprove ? "NOW()" : null}
      )
      RETURNING id
    `

    const exchangeId = result[0].id

    // If auto-approve, perform the shift swap
    if (data.autoApprove) {
      await sql`BEGIN`

      try {
        const requesterShifts = await sql`
          SELECT id FROM shifts
          WHERE team_id = ${data.requesterTeamId}
          AND shift_type = ${data.requesterShiftType}
          LIMIT 1
        `

        if (requesterShifts.length === 0) {
          await sql`ROLLBACK`
          return { error: "Impossible de trouver le quart du demandeur" }
        }

        const requesterShiftId = requesterShifts[0].id

        const targetShifts = await sql`
          SELECT id FROM shifts
          WHERE team_id = ${data.targetTeamId}
          AND shift_type = ${data.targetShiftType}
          LIMIT 1
        `

        if (targetShifts.length === 0) {
          await sql`ROLLBACK`
          return { error: "Impossible de trouver le quart de la cible" }
        }

        const targetShiftId = targetShifts[0].id

        console.log("[v0] Requester shift_id:", requesterShiftId, "Target shift_id:", targetShiftId)

        await sql`
          DELETE FROM shift_assignments
          WHERE (shift_id = ${requesterShiftId} AND user_id IN (${data.requesterId}, ${data.targetId}))
          OR (shift_id = ${targetShiftId} AND user_id IN (${data.requesterId}, ${data.targetId}))
        `

        console.log("[v0] Deleted all conflicting assignments")

        await sql`
          INSERT INTO shift_assignments (user_id, shift_id, is_extra, is_partial, start_time, end_time)
          VALUES 
            (${data.targetId}, ${requesterShiftId}, false, ${data.isPartial}, ${data.requesterStartTime || null}, ${data.requesterEndTime || null}),
            (${data.requesterId}, ${targetShiftId}, false, ${data.isPartial}, ${data.targetStartTime || null}, ${data.targetEndTime || null})
        `

        console.log("[v0] Created swapped assignments")

        await sql`
          INSERT INTO user_exchange_counts (user_id, year, exchange_count)
          VALUES (${data.requesterId}, ${requesterShiftYear}, 1)
          ON CONFLICT (user_id, year)
          DO UPDATE SET 
            exchange_count = user_exchange_counts.exchange_count + 1,
            updated_at = NOW()
        `

        await sql`COMMIT`
        console.log("[v0] Exchange created and approved by admin:", exchangeId)
      } catch (error) {
        await sql`ROLLBACK`
        console.error("[v0] Error in transaction:", error)
        return { error: "Erreur lors de l'approbation automatique de l'échange" }
      }
    }

    // Send notification emails
    try {
      const users = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id IN (${data.requesterId}, ${data.targetId})
      `

      const requesterUser = users.find((u: any) => u.id === data.requesterId)
      const targetUser = users.find((u: any) => u.id === data.targetId)

      const requesterPartialHours =
        data.isPartial && data.requesterStartTime && data.requesterEndTime
          ? `${data.requesterStartTime.slice(0, 5)} - ${data.requesterEndTime.slice(0, 5)}`
          : ""

      const targetPartialHours =
        data.isPartial && data.targetStartTime && data.targetEndTime
          ? `${data.targetStartTime.slice(0, 5)} - ${data.targetEndTime.slice(0, 5)}`
          : ""

      const requesterShiftDate = new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      const targetShiftDate = new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      if (data.autoApprove) {
        // Send approval emails to both users
        if (requesterUser?.email) {
          await createNotification(
            requesterUser.id,
            "✅ Échange de quart approuvé",
            `Votre échange de quart avec ${targetUser.first_name} ${targetUser.last_name} a été approuvé: ${requesterShiftDate} (${data.requesterShiftType}) contre ${targetShiftDate} (${data.targetShiftType})${data.isPartial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
            "exchange_approved",
            exchangeId,
            "shift_exchange",
          )
        }

        if (targetUser?.email) {
          await createNotification(
            data.targetId,
            "✅ Échange de quart approuvé",
            `Votre échange de quart avec ${requesterUser.first_name} ${requesterUser.last_name} a été approuvé: ${targetShiftDate} (${data.targetShiftType}) contre ${requesterShiftDate} (${data.requesterShiftType})${data.isPartial ? ` - Partiel: ${targetPartialHours} / ${requesterPartialHours}` : ""}`,
            "exchange_approved",
            exchangeId,
            "shift_exchange",
          )
        }
      } else {
        // Send request email to target and confirmation to requester
        if (targetUser?.email) {
          await createNotification(
            data.targetId,
            "Nouvelle demande d'échange de quart",
            `${requesterUser.first_name} ${requesterUser.last_name} vous propose un échange de quart: ${requesterShiftDate} (${data.requesterShiftType}) contre ${targetShiftDate} (${data.targetShiftType})${data.isPartial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
            "exchange_request",
            exchangeId,
            "shift_exchange",
          )
        }

        if (requesterUser?.email) {
          await createNotification(
            data.requesterId,
            "Demande d'échange envoyée",
            `Votre demande d'échange avec ${targetUser.first_name} ${targetUser.last_name} a été envoyée: ${requesterShiftDate} (${data.requesterShiftType}) contre ${targetShiftDate} (${data.targetShiftType})${data.isPartial ? ` - Partiel: ${requesterPartialHours} / ${targetPartialHours}` : ""}`,
            "exchange_request_confirmation",
            exchangeId,
            "shift_exchange",
          )
        }
      }
    } catch (emailError) {
      console.error("[v0] Error sending emails:", emailError)
    }

    revalidatePath("/dashboard/exchanges")
    revalidatePath("/dashboard/calendar")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true, warning }
  } catch (error) {
    console.error("[v0] Error creating exchange as admin:", error)
    return { error: "Erreur lors de la création de l'échange" }
  }
}

export async function getPendingExchangesCount() {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return 0
    }

    const result = await sql`
      SELECT COUNT(*) as count
      FROM shift_exchanges
      WHERE status = 'pending'
    `

    return Number(result[0]?.count || 0)
  } catch (error) {
    console.error("getPendingExchangesCount: Error", error)
    return 0
  }
}

export async function getExchangesAdminActionCount(): Promise<number> {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return 0
    }

    // Count pending exchanges that need admin approval
    const result = await sql`
      SELECT COUNT(*) as count
      FROM shift_exchanges
      WHERE status = 'pending'
    `

    return Number(result[0]?.count || 0)
  } catch (error) {
    console.error("getExchangesAdminActionCount: Error", error)
    return 0
  }
}
