import { type NextRequest, NextResponse } from "next/server"
import { getCalendarDataForDateRange } from "@/app/actions/calendar"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate or endDate" }, { status: 400 })
  }

  try {
    const data = await getCalendarDataForDateRange(startDate, endDate)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching calendar data:", error)
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 })
  }
}
