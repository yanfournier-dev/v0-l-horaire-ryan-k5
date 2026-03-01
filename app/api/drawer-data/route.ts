import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { shiftId, shiftDate, shiftType, teamId } = await request.json()

    if (!shiftId || !shiftDate || !shiftType || !teamId) {
      return NextResponse.json(
        { error: "Missing required parameters: shiftId, shiftDate, shiftType, teamId" },
        { status: 400 }
      )
    }

    const startTime = performance.now()

    // Get all replacements for this shift with their applications
    const replacementsResult = await sql`
      SELECT
        r.*,
        u.first_name,
        u.last_name,
        u.role,
        u.email,
        (
          SELECT json_agg(
            json_build_object(
              'id', ra.id,
              'applicant_id', ra.applicant_id,
              'status', ra.status,
              'applied_at', ra.applied_at,
              'first_name', app_user.first_name,
              'last_name', app_user.last_name
            )
          )
          FROM replacement_applications ra
          JOIN users app_user ON ra.applicant_id = app_user.id
          WHERE ra.replacement_id = r.id
        ) as applications
      FROM replacements r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.shift_date = ${shiftDate}
        AND r.shift_type = ${shiftType}
        AND r.team_id = ${teamId}
      ORDER BY r.created_at DESC
    `

    // Get shift assignments (is_acting_lieutenant, is_acting_captain) for this shift
    const assignmentsResult = await sql`
      SELECT 
        user_id,
        is_acting_lieutenant,
        is_acting_captain
      FROM shift_assignments
      WHERE shift_id = ${shiftId}
    `

    const duration = performance.now() - startTime
    console.log(`[v0] API drawer-data completed in ${duration.toFixed(0)}ms`)

    return NextResponse.json({
      replacements: replacementsResult,
      assignments: assignmentsResult,
      duration,
    })
  } catch (error) {
    console.error("[v0] drawer-data API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch drawer data", details: String(error) },
      { status: 500 }
    )
  }
}
