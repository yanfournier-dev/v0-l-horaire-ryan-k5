"use server"

import { neon } from "@neondatabase/serverless"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { sendEmail, getExchangeRequestEmail, getExchangeApprovedEmail, getExchangeRejectedEmail } from "@/lib/email"
import { parseLocalDate } from "@/lib/calendar"

const sql = neon(process.env.DATABASE_URL!)

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

    // Check if user has reached the limit of 8 exchanges per year
    const currentYear = new Date().getFullYear()
    const exchangeCount = await sql`
      SELECT exchange_count
      FROM user_exchange_counts
      WHERE user_id = ${user.id}
      AND year = ${currentYear}
    `

    const count = exchangeCount.length > 0 ? exchangeCount[0].exchange_count : 0
    if (count >= 8) {
      return { error: "Vous avez atteint la limite de 8 échanges par année" }
    }

    // Create the exchange request
    await sql`
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
    `

    try {
      const targetUser = await sql`
        SELECT email, first_name, last_name
        FROM users
        WHERE id = ${data.targetId}
      `

      if (targetUser.length > 0 && targetUser[0].email) {
        const requesterPartialHours =
          data.isPartial && data.requesterStartTime && data.requesterEndTime
            ? `${data.requesterStartTime.slice(0, 5)} - ${data.requesterEndTime.slice(0, 5)}`
            : undefined

        const targetPartialHours =
          data.isPartial && data.targetStartTime && data.targetEndTime
            ? `${data.targetStartTime.slice(0, 5)} - ${data.targetEndTime.slice(0, 5)}`
            : undefined

        const emailContent = await getExchangeRequestEmail(
          `${targetUser[0].first_name} ${targetUser[0].last_name}`,
          `${user.first_name} ${user.last_name}`,
          new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          data.requesterShiftType,
          new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          data.targetShiftType,
          data.isPartial,
          requesterPartialHours,
          targetPartialHours,
        )

        if (emailContent) {
          const emailResult = await sendEmail({
            to: targetUser[0].email,
            subject: emailContent.subject,
            html: emailContent.html,
          })

          // Log test mode restriction as info, not error
          if (emailResult.isTestModeRestriction) {
            console.log("[v0] Exchange request created successfully, but email not sent due to Resend test mode")
            console.log("[v0] The user will see the exchange request in their dashboard")
          }
        }
      }
    } catch (emailError) {
      // Don't fail the exchange creation if email fails
      console.error("[v0] Error sending exchange request email:", emailError)
    }

    revalidatePath("/dashboard/exchanges")
    return { success: true }
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
    return { error: "Erreur lors de la récupération des échanges en attente" }
  }
}

export async function getUserExchangeCount(userId: number) {
  try {
    const currentYear = new Date().getFullYear()
    const result = await sql`
      SELECT exchange_count
      FROM user_exchange_counts
      WHERE user_id = ${userId}
      AND year = ${currentYear}
    `

    return { count: result.length > 0 ? result[0].exchange_count : 0 }
  } catch (error: any) {
    console.error("[v0] Error getting exchange count:", error)
    if (error.message?.includes("does not exist")) {
      return { count: 0, tablesMissing: true }
    }
    return { count: 0 }
  }
}

export async function approveExchange(exchangeId: number) {
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

    console.log("[v0] Approving exchange:", exchangeId, exchange)

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

      // 1. Find or create requester's shift assignment
      let requesterAssignments = await sql`
        SELECT sa.id, sa.shift_id
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ${exchange.requester_id}
        AND s.team_id = ${exchange.requester_team_id}
        AND s.shift_type = ${exchange.requester_shift_type}
        AND NOT sa.is_extra
        LIMIT 1
      `

      if (requesterAssignments.length === 0) {
        console.log("[v0] Creating shift_assignment for requester")
        // Find the shift for this team and shift type
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

        // Create the shift_assignment
        const newAssignment = await sql`
          INSERT INTO shift_assignments (user_id, shift_id, is_extra)
          VALUES (${exchange.requester_id}, ${requesterShifts[0].id}, false)
          RETURNING id, shift_id
        `
        requesterAssignments = newAssignment
      }

      // 2. Find or create target's shift assignment
      let targetAssignments = await sql`
        SELECT sa.id, sa.shift_id
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ${exchange.target_id}
        AND s.team_id = ${exchange.target_team_id}
        AND s.shift_type = ${exchange.target_shift_type}
        AND NOT sa.is_extra
        LIMIT 1
      `

      if (targetAssignments.length === 0) {
        console.log("[v0] Creating shift_assignment for target")
        // Find the shift for this team and shift type
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

        // Create the shift_assignment
        const newAssignment = await sql`
          INSERT INTO shift_assignments (user_id, shift_id, is_extra)
          VALUES (${exchange.target_id}, ${targetShifts[0].id}, false)
          RETURNING id, shift_id
        `
        targetAssignments = newAssignment
      }

      const requesterAssignment = requesterAssignments[0]
      const targetAssignment = targetAssignments[0]

      console.log("[v0] Swapping assignments:", requesterAssignment.id, "and", targetAssignment.id)

      // 3. Swap the user_ids in shift_assignments
      await sql`
        UPDATE shift_assignments
        SET 
          user_id = ${exchange.target_id},
          is_partial = ${exchange.is_partial},
          start_time = ${exchange.requester_start_time || null},
          end_time = ${exchange.requester_end_time || null}
        WHERE id = ${requesterAssignment.id}
      `

      await sql`
        UPDATE shift_assignments
        SET 
          user_id = ${exchange.requester_id},
          is_partial = ${exchange.is_partial},
          start_time = ${exchange.target_start_time || null},
          end_time = ${exchange.target_end_time || null}
        WHERE id = ${targetAssignment.id}
      `

      // 4. Increment exchange count for requester
      const currentYear = new Date().getFullYear()
      await sql`
        INSERT INTO user_exchange_counts (user_id, year, exchange_count)
        VALUES (${exchange.requester_id}, ${currentYear}, 1)
        ON CONFLICT (user_id, year)
        DO UPDATE SET 
          exchange_count = user_exchange_counts.exchange_count + 1,
          updated_at = NOW()
      `

      await sql`COMMIT`

      console.log("[v0] Exchange approved successfully:", exchangeId)

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
            : undefined

        const targetPartialHours =
          exchange.is_partial && exchange.target_start_time && exchange.target_end_time
            ? `${exchange.target_start_time.slice(0, 5)} - ${exchange.target_end_time.slice(0, 5)}`
            : undefined

        // Email to requester
        if (requesterUser?.email) {
          const emailContent = await getExchangeApprovedEmail(
            `${requesterUser.first_name} ${requesterUser.last_name}`,
            `${targetUser.first_name} ${targetUser.last_name}`,
            new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            exchange.requester_shift_type,
            new Date(exchange.target_shift_date).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            exchange.target_shift_type,
            exchange.is_partial,
            requesterPartialHours,
            targetPartialHours,
          )

          if (emailContent) {
            await sendEmail({
              to: requesterUser.email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          }
        }

        // Email to target
        if (targetUser?.email) {
          const emailContent = await getExchangeApprovedEmail(
            `${targetUser.first_name} ${targetUser.last_name}`,
            `${requesterUser.first_name} ${requesterUser.last_name}`,
            new Date(exchange.target_shift_date).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            exchange.target_shift_type,
            new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            exchange.requester_shift_type,
            exchange.is_partial,
            targetPartialHours,
            requesterPartialHours,
          )

          if (emailContent) {
            await sendEmail({
              to: targetUser.email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          }
        }
      } catch (emailError) {
        console.error("[v0] Error sending approval emails:", emailError)
      }

      revalidatePath("/dashboard/exchanges")
      revalidatePath("/dashboard/calendar")
      return { success: true }
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

    try {
      const users = await sql`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id IN (${exchange.requester_id}, ${exchange.target_id})
      `

      const requesterUser = users.find((u: any) => u.id === exchange.requester_id)
      const targetUser = users.find((u: any) => u.id === exchange.target_id)

      if (requesterUser?.email) {
        const requesterPartialHours =
          exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time
            ? `${exchange.requester_start_time.slice(0, 5)} - ${exchange.requesterEndTime.slice(0, 5)}`
            : undefined

        const targetPartialHours =
          exchange.is_partial && exchange.target_start_time && exchange.target_end_time
            ? `${exchange.target_start_time.slice(0, 5)} - ${exchange.target_end_time.slice(0, 5)}`
            : undefined

        const emailContent = await getExchangeRejectedEmail(
          `${requesterUser.first_name} ${requesterUser.last_name}`,
          `${targetUser.first_name} ${targetUser.last_name}`,
          new Date(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          exchange.requester_shift_type,
          new Date(exchange.target_shift_date).toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          exchange.target_shift_type,
          reason,
          exchange.is_partial,
          requesterPartialHours,
          targetPartialHours,
        )

        if (emailContent) {
          await sendEmail({
            to: requesterUser.email,
            subject: emailContent.subject,
            html: emailContent.html,
          })
        }
      }
    } catch (emailError) {
      console.error("[v0] Error sending rejection email:", emailError)
    }

    revalidatePath("/dashboard/exchanges")
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
        // Find the swapped shift assignments and revert them
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
          // Swap back the user_ids
          await sql`
            UPDATE shift_assignments
            SET 
              user_id = ${exchange.requester_id},
              is_partial = false,
              start_time = NULL,
              end_time = NULL
            WHERE id = ${requesterAssignments[0].id}
          `

          await sql`
            UPDATE shift_assignments
            SET 
              user_id = ${exchange.target_id},
              is_partial = false,
              start_time = NULL,
              end_time = NULL
            WHERE id = ${targetAssignments[0].id}
          `

          // Decrement exchange count for requester
          const currentYear = new Date().getFullYear()
          await sql`
            UPDATE user_exchange_counts
            SET 
              exchange_count = GREATEST(0, exchange_count - 1),
              updated_at = NOW()
            WHERE user_id = ${exchange.requester_id}
            AND year = ${currentYear}
          `
        }

        // Update exchange status to cancelled
        await sql`
          UPDATE shift_exchanges
          SET 
            status = 'cancelled',
            updated_at = NOW()
          WHERE id = ${exchangeId}
        `

        await sql`COMMIT`
        console.log("[v0] Approved exchange deleted and reverted:", exchangeId, "by admin:", user.id)
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
          status = 'cancelled',
          updated_at = NOW()
        WHERE id = ${exchangeId}
      `

      console.log("[v0] Exchange request cancelled:", exchangeId, "by user:", user.id)
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split("T")[0]

    console.log("[v0] Getting all exchanges for admin, filtering from date:", todayStr)

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
      WHERE (se.requester_shift_date >= ${todayStr}::date
      OR se.target_shift_date >= ${todayStr}::date)
      AND se.status != 'cancelled'
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
}) {
  try {
    const user = await getSession()
    if (!user || !user.is_admin) {
      return { error: "Non autorisé" }
    }

    // Check if requester has reached the limit of 8 exchanges per year
    const currentYear = new Date().getFullYear()
    const exchangeCount = await sql`
      SELECT exchange_count
      FROM user_exchange_counts
      WHERE user_id = ${data.requesterId}
      AND year = ${currentYear}
    `

    const count = exchangeCount.length > 0 ? exchangeCount[0].exchange_count : 0
    if (count >= 8) {
      return { error: "Le pompier a atteint la limite de 8 échanges par année" }
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
        // Find requester's shift assignment
        const requesterAssignments = await sql`
          SELECT sa.id, sa.shift_id
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE sa.user_id = ${data.requesterId}
          AND s.team_id = ${data.requesterTeamId}
          AND s.shift_type = ${data.requesterShiftType}
          AND NOT sa.is_extra
          LIMIT 1
        `

        // Find target's shift assignment
        const targetAssignments = await sql`
          SELECT sa.id, sa.shift_id
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE sa.user_id = ${data.targetId}
          AND s.team_id = ${data.targetTeamId}
          AND s.shift_type = ${data.targetShiftType}
          AND NOT sa.is_extra
          LIMIT 1
        `

        if (requesterAssignments.length === 0 || targetAssignments.length === 0) {
          await sql`ROLLBACK`
          return { error: "Impossible de trouver les assignations de quarts" }
        }

        const requesterAssignment = requesterAssignments[0]
        const targetAssignment = targetAssignments[0]

        // Swap the user_ids in shift_assignments
        await sql`
          UPDATE shift_assignments
          SET 
            user_id = ${data.targetId},
            is_partial = ${data.isPartial},
            start_time = ${data.requesterStartTime || null},
            end_time = ${data.requesterEndTime || null}
          WHERE id = ${requesterAssignment.id}
        `

        await sql`
          UPDATE shift_assignments
          SET 
            user_id = ${data.requesterId},
            is_partial = ${data.isPartial},
            start_time = ${data.targetStartTime || null},
            end_time = ${data.targetEndTime || null}
          WHERE id = ${targetAssignment.id}
        `

        // Increment exchange count for requester
        await sql`
          INSERT INTO user_exchange_counts (user_id, year, exchange_count)
          VALUES (${data.requesterId}, ${currentYear}, 1)
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

      // Send appropriate emails based on auto-approve status
      if (data.autoApprove) {
        // Send approval emails
        const requesterPartialHours =
          data.isPartial && data.requesterStartTime && data.requesterEndTime
            ? `${data.requesterStartTime.slice(0, 5)} - ${data.requesterEndTime.slice(0, 5)}`
            : undefined

        const targetPartialHours =
          data.isPartial && data.targetStartTime && data.targetEndTime
            ? `${data.targetStartTime.slice(0, 5)} - ${data.targetEndTime.slice(0, 5)}`
            : undefined

        if (requesterUser?.email) {
          const emailContent = await getExchangeApprovedEmail(
            `${requesterUser.first_name} ${requesterUser.last_name}`,
            `${targetUser.first_name} ${targetUser.last_name}`,
            new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.requesterShiftType,
            new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.targetShiftType,
            data.isPartial,
            requesterPartialHours,
            targetPartialHours,
          )

          if (emailContent) {
            await sendEmail({
              to: requesterUser.email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          }
        }

        if (targetUser?.email) {
          const emailContent = await getExchangeApprovedEmail(
            `${targetUser.first_name} ${targetUser.last_name}`,
            `${requesterUser.first_name} ${requesterUser.last_name}`,
            new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.targetShiftType,
            new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.requesterShiftType,
            data.isPartial,
            targetPartialHours,
            requesterPartialHours,
          )

          if (emailContent) {
            await sendEmail({
              to: targetUser.email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          }
        }
      } else {
        // Send request email to target
        if (targetUser?.email) {
          const requesterPartialHours =
            data.isPartial && data.requesterStartTime && data.requesterEndTime
              ? `${data.requesterStartTime.slice(0, 5)} - ${data.requesterEndTime.slice(0, 5)}`
              : undefined

          const targetPartialHours =
            data.isPartial && data.targetStartTime && data.targetEndTime
              ? `${data.targetStartTime.slice(0, 5)} - ${data.targetEndTime.slice(0, 5)}`
              : undefined

          const emailContent = await getExchangeRequestEmail(
            `${targetUser.first_name} ${targetUser.last_name}`,
            `${requesterUser.first_name} ${requesterUser.last_name}`,
            new Date(data.requesterShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.requesterShiftType,
            new Date(data.targetShiftDate).toLocaleDateString("fr-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            data.targetShiftType,
            data.isPartial,
            requesterPartialHours,
            targetPartialHours,
          )

          if (emailContent) {
            await sendEmail({
              to: targetUser.email,
              subject: emailContent.subject,
              html: emailContent.html,
            })
          }
        }
      }
    } catch (emailError) {
      console.error("[v0] Error sending emails:", emailError)
    }

    revalidatePath("/dashboard/exchanges")
    revalidatePath("/dashboard/calendar")
    return { success: true }
  } catch (error) {
    console.error("[v0] Error creating exchange as admin:", error)
    return { error: "Erreur lors de la création de l'échange" }
  }
}
