import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Support both single assignment and batch queries
    if (body.userId) {
      // Original single assignment query
      const { shiftId, userId } = body

      if (!shiftId || !userId) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
      }

      const result = await sql`
        SELECT is_acting_lieutenant, is_acting_captain
        FROM shift_assignments
        WHERE shift_id = ${shiftId} AND user_id = ${userId}
        LIMIT 1
      `

      if (result.length === 0) {
        return NextResponse.json({
          is_acting_lieutenant: false,
          is_acting_captain: false,
        })
      }

      return NextResponse.json({
        is_acting_lieutenant: result[0].is_acting_lieutenant || false,
        is_acting_captain: result[0].is_acting_captain || false,
      })
    } else if (body.shiftId && body.userIds && Array.isArray(body.userIds)) {
      // Batch query - much faster!
      const { shiftId, userIds } = body

      if (!shiftId || userIds.length === 0) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
      }

      const results = await sql`
        SELECT user_id, is_acting_lieutenant, is_acting_captain
        FROM shift_assignments
        WHERE shift_id = ${shiftId} AND user_id = ANY(${userIds})
      `

      // Create a map for quick lookup
      const assignmentMap: Record<number, { is_acting_lieutenant: boolean; is_acting_captain: boolean }> = {}

      for (const userId of userIds) {
        const result = results.find((r: any) => r.user_id === userId)
        assignmentMap[userId] = {
          is_acting_lieutenant: result?.is_acting_lieutenant || false,
          is_acting_captain: result?.is_acting_captain || false,
        }
      }

      return NextResponse.json(assignmentMap)
    } else {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] get-shift-assignment API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
