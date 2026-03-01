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

    // Get all data in ONE query for better performance
    // This includes replacements with applications and shift assignments
    const replacementsResult = await sql`
      SELECT 
        r.id,
        r.shift_id,
        r.original_firefighter_id,
        r.status,
        r.created_at,
        json_agg(
          json_build_object(
            'id', a.id,
            'applicant_id', a.applicant_id,
            'applicant_name', ff.first_name || ' ' || ff.last_name,
            'applicant_phone', ff.phone,
            'status', a.status,
            'created_at', a.created_at
          )
        ) as applications
      FROM replacements r
      LEFT JOIN replacement_applications a ON r.id = a.replacement_id
      LEFT JOIN firefighters ff ON a.applicant_id = ff.id
      WHERE r.shift_id = ${shiftId}
      GROUP BY r.id, r.shift_id, r.original_firefighter_id, r.status, r.created_at
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

    // Get acting designations for the date range
    const actingDesignationsResult = await sql`
      SELECT 
        user_id,
        role
      FROM acting_designations
      WHERE date = ${shiftDate}
    `

    const duration = performance.now() - startTime
    console.log(`[v0] API drawer-data completed in ${duration.toFixed(0)}ms`)

    return NextResponse.json({
      replacements: replacementsResult,
      assignments: assignmentsResult,
      actingDesignations: actingDesignationsResult,
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
