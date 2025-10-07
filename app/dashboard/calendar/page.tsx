import { getSession } from "@/lib/auth"
import {
  getCycleConfig,
  getAllShiftsWithAssignments,
  getReplacementsForDateRange,
  getLeavesForDateRange,
} from "@/app/actions/calendar"
import { redirect } from "next/navigation"
import { generateMonthView, getCycleDay, getMonthName, parseLocalDate } from "@/lib/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarCell } from "@/components/calendar-cell"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

    const days = generateMonthView(selectedYear, selectedMonth, cycleStartDate)

    const allShifts = await getAllShiftsWithAssignments()

    const firstDay = days[0]?.date
    const lastDay = days[days.length - 1]?.date

    const replacements =
      firstDay && lastDay
        ? await getReplacementsForDateRange(firstDay.toISOString().split("T")[0], lastDay.toISOString().split("T")[0])
        : []

    const leaves =
      firstDay && lastDay
        ? await getLeavesForDateRange(firstDay.toISOString().split("T")[0], lastDay.toISOString().split("T")[0])
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

    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear

    const yearOptions = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i)

    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {getMonthName(selectedMonth)} {selectedYear}
              </h1>
            </div>

            <div className="flex gap-2">
              {user.is_admin && (
                <Link href="/dashboard/calendar/manage">
                  <Button className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">Gérer les quarts</Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/calendar?year=${prevYear}&month=${prevMonth}`}>
                <Button variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/dashboard/calendar?year=${today.getFullYear()}&month=${today.getMonth()}`}>
                <Button variant="outline" className="px-4 bg-transparent">
                  Aujourd'hui
                </Button>
              </Link>
              <Link href={`/dashboard/calendar?year=${nextYear}&month=${nextMonth}`}>
                <Button variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex gap-2 flex-1 sm:flex-initial">
              <form method="GET" className="flex gap-2 flex-1">
                <Select name="month" defaultValue={selectedMonth.toString()}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {getMonthName(i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select name="year" defaultValue={selectedYear.toString()}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button type="submit" variant="outline">
                  Aller
                </Button>
              </form>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-3">
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
              <div
                key={day}
                className="text-center text-xs md:text-sm font-semibold text-muted-foreground py-1 md:py-2"
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-1 md:gap-3 grid-cols-7">
          {days.map((day, index) => {
            const shifts = shiftsByCycleDay[day.cycleDay] || []

            const dateStr = day.date.toISOString().split("T")[0]
            const dayReplacements = shifts.map((shift: any) => {
              const key = `${dateStr}_${shift.shift_type}_${shift.team_id}`
              return replacementMap[key] || []
            })

            return (
              <CalendarCell
                key={index}
                day={day}
                shifts={shifts}
                replacements={dayReplacements}
                leaves={leaves}
                leaveMap={leaveMap}
                dateStr={dateStr}
                isAdmin={user.is_admin}
              />
            )
          })}
        </div>
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
