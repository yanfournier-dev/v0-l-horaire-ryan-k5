import { getSession } from "@/lib/auth"
import {
  getCycleConfig,
  getAllShiftsWithAssignments,
  getReplacementsForDateRange,
  getLeavesForDateRange,
  getExchangesForDateRange,
} from "@/app/actions/calendar"
import { redirect } from "next/navigation"
import { generateMonthView, getCycleDay, parseLocalDate } from "@/lib/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarView } from "@/components/calendar-view"
import { TodayButton } from "@/components/today-button"

export const dynamic = "force-dynamic"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  try {
    const user = await getSession()

    if (!user) redirect("/login")

    const cycleConfig = await getCycleConfig()

    if (!cycleConfig) {
      return (
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Configuration du cycle non trouvée</p>
            </CardContent>
          </Card>
        </div>
      )
    }

    const cycleStartDate = parseLocalDate(cycleConfig.start_date)

    const today = new Date()

    const selectedYear = searchParams.year ? Number.parseInt(searchParams.year) : today.getFullYear()
    const selectedMonth = searchParams.month ? Number.parseInt(searchParams.month) : today.getMonth()

    const currentCycleDay = getCycleDay(today, cycleStartDate)

    const monthsToDisplay = [
      {
        year: selectedMonth - 2 < 0 ? selectedYear - 1 : selectedYear,
        month: (selectedMonth - 2 + 12) % 12,
      },
      {
        year: selectedMonth - 1 < 0 ? selectedYear - 1 : selectedYear,
        month: (selectedMonth - 1 + 12) % 12,
      },
      { year: selectedYear, month: selectedMonth },
      {
        year: selectedMonth + 1 > 11 ? selectedYear + 1 : selectedYear,
        month: (selectedMonth + 1) % 12,
      },
      {
        year: selectedMonth + 2 > 11 ? selectedYear + 1 : selectedYear,
        month: (selectedMonth + 2) % 12,
      },
    ]

    const allMonthsDays = monthsToDisplay.map(({ year, month }) => ({
      year,
      month,
      days: generateMonthView(year, month, cycleStartDate),
    }))

    const allShifts = await getAllShiftsWithAssignments()

    const firstDay = allMonthsDays[0].days[0]?.date
    const lastDay =
      allMonthsDays[allMonthsDays.length - 1].days[allMonthsDays[allMonthsDays.length - 1].days.length - 1]?.date

    const replacements =
      firstDay && lastDay
        ? await getReplacementsForDateRange(firstDay.toISOString().split("T")[0], lastDay.toISOString().split("T")[0])
        : []

    const leaves =
      firstDay && lastDay
        ? await getLeavesForDateRange(firstDay.toISOString().split("T")[0], lastDay.toISOString().split("T")[0])
        : []

    const exchanges =
      firstDay && lastDay
        ? await getExchangesForDateRange(firstDay.toISOString().split("T")[0], lastDay.toISOString().split("T")[0])
        : []

    const replacementMap: Record<string, any[]> = {}
    replacements.forEach((repl: any) => {
      const dateOnly = new Date(repl.shift_date).toISOString().split("T")[0]
      const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
      if (!replacementMap[key]) {
        replacementMap[key] = []
      }
      replacementMap[key].push(repl)
    })

    const exchangeMap: Record<string, any[]> = {}
    exchanges.forEach((exchange: any) => {
      const requesterDateOnly = new Date(exchange.requester_shift_date).toISOString().split("T")[0]
      const requesterKey = `${requesterDateOnly}_${exchange.requester_shift_type}_${exchange.requester_team_id}`
      if (!exchangeMap[requesterKey]) {
        exchangeMap[requesterKey] = []
      }
      exchangeMap[requesterKey].push({
        ...exchange,
        type: "requester",
      })

      const targetDateOnly = new Date(exchange.target_shift_date).toISOString().split("T")[0]
      const targetKey = `${targetDateOnly}_${exchange.target_shift_type}_${exchange.target_team_id}`
      if (!exchangeMap[targetKey]) {
        exchangeMap[targetKey] = []
      }
      exchangeMap[targetKey].push({
        ...exchange,
        type: "target",
      })
    })

    const leaveMap: Record<string, any[]> = {}
    leaves.forEach((leave: any) => {
      const startDate = new Date(leave.start_date)
      const endDate = new Date(leave.end_date)

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0]
        const key = `${dateStr}_${leave.user_id}`
        if (!leaveMap[key]) {
          leaveMap[key] = []
        }
        leaveMap[key].push(leave)
      }
    })

    const shiftsByCycleDay: Record<number, any[]> = {}
    allShifts.forEach((shift: any) => {
      if (!shiftsByCycleDay[shift.cycle_day]) {
        shiftsByCycleDay[shift.cycle_day] = []
      }
      shiftsByCycleDay[shift.cycle_day].push(shift)
    })

    const shiftTypeOrder: Record<string, number> = {
      full_24h: 1,
      day: 2,
      night: 3,
    }

    Object.keys(shiftsByCycleDay).forEach((cycleDay) => {
      shiftsByCycleDay[Number(cycleDay)].sort((a, b) => {
        const orderA = shiftTypeOrder[a.shift_type] || 999
        const orderB = shiftTypeOrder[b.shift_type] || 999
        return orderA - orderB
      })
    })

    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendrier des quarts</h1>
              <TodayButton />
            </div>

            <div className="flex gap-2">
              {user.is_admin && (
                <Link href="/dashboard/calendar/manage">
                  <Button className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">Gérer les quarts</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <CalendarView
          initialMonths={allMonthsDays}
          shiftsByCycleDay={shiftsByCycleDay}
          replacementMap={replacementMap}
          exchangeMap={exchangeMap}
          leaves={leaves}
          leaveMap={leaveMap}
          isAdmin={user.is_admin}
          cycleStartDate={cycleStartDate}
          currentYear={selectedYear}
          currentMonth={selectedMonth}
        />
      </div>
    )
  } catch (error) {
    console.error("[v0] Calendar page error:", error)

    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">Une erreur s'est produite</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Erreur: {error instanceof Error ? error.message : String(error)}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}
