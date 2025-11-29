import { getSession } from "@/app/actions/auth"
import {
  getCycleConfig,
  getAllShiftsWithAssignments,
  getReplacementsForDateRange,
  getLeavesForDateRange,
  getExchangesForDateRange,
  getDirectAssignmentsForDateRange,
  getActingDesignationsForRange,
} from "@/app/actions/calendar"
import { getShiftNotesForDateRange } from "@/app/actions/shift-notes"
import { redirect } from "next/navigation"
import { generateMonthView, getCycleDay, parseLocalDate } from "@/lib/calendar"
import { formatDateForDB, getTodayInLocalTimezone } from "@/lib/date-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarView } from "@/components/calendar-view"
import { CalendarMonthNavigation } from "@/components/calendar-month-navigation"
import { ScrollToTodayOnNav } from "@/components/scroll-to-today-on-nav"

export const dynamic = "force-dynamic"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; scrollToToday?: string }
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

    const today = getTodayInLocalTimezone()

    const selectedYear = searchParams.year ? Number.parseInt(searchParams.year) : today.getFullYear()
    const selectedMonth = searchParams.month ? Number.parseInt(searchParams.month) : today.getMonth()

    const currentCycleDay = getCycleDay(today, cycleStartDate)

    // To revert to original behavior (3 months: 1 before + current + 1 after), replace this block with:
    // const monthsToDisplay = [
    //   {
    //     year: selectedMonth - 1 < 0 ? selectedYear - 1 : selectedYear,
    //     month: selectedMonth - 1 < 0 ? 11 : selectedMonth - 1,
    //   },
    //   { year: selectedYear, month: selectedMonth },
    //   {
    //     year: selectedMonth + 1 > 11 ? selectedYear + 1 : selectedYear,
    //     month: (selectedMonth + 1) % 12,
    //   },
    // ]
    const monthsToDisplay = []
    for (let i = 0; i < 12; i++) {
      const targetMonth = selectedMonth + i
      const targetYear = selectedYear + Math.floor(targetMonth / 12)
      const normalizedMonth = targetMonth % 12

      monthsToDisplay.push({
        year: targetYear,
        month: normalizedMonth,
      })
    }

    const allMonthsDays = monthsToDisplay.map(({ year, month }) => ({
      year,
      month,
      days: generateMonthView(year, month, cycleStartDate),
    }))

    const firstDay = allMonthsDays[0].days[0]?.date
    const lastMonthDays = allMonthsDays[allMonthsDays.length - 1].days
    const lastDay = lastMonthDays[lastMonthDays.length - 1]?.date

    const allShifts = await getAllShiftsWithAssignments(firstDay, lastDay)

    const [replacements, leaves, exchanges, shiftNotes, directAssignments, actingDesignations] = await Promise.all([
      firstDay && lastDay ? getReplacementsForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
      firstDay && lastDay ? getLeavesForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
      firstDay && lastDay ? getExchangesForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
      firstDay && lastDay ? getShiftNotesForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
      firstDay && lastDay ? getDirectAssignmentsForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
      firstDay && lastDay ? getActingDesignationsForRange(formatDateForDB(firstDay), formatDateForDB(lastDay)) : [],
    ])

    const replacementMap: Record<string, any[]> = {}
    replacements.forEach((repl: any) => {
      const dateOnly = formatDateForDB(new Date(repl.shift_date))
      const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
      if (!replacementMap[key]) {
        replacementMap[key] = []
      }
      replacementMap[key].push(repl)
    })

    const exchangeMap: Record<string, any[]> = {}
    exchanges.forEach((exchange: any) => {
      const requesterDateOnly = formatDateForDB(new Date(exchange.requester_shift_date))
      const requesterKey = `${requesterDateOnly}_${exchange.requester_shift_type}_${exchange.requester_team_id}`
      if (!exchangeMap[requesterKey]) {
        exchangeMap[requesterKey] = []
      }
      exchangeMap[requesterKey].push({
        ...exchange,
        type: "requester",
      })

      const targetDateOnly = formatDateForDB(new Date(exchange.target_shift_date))
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
        const dateStr = formatDateForDB(d)
        const key = `${dateStr}_${leave.user_id}`
        if (!leaveMap[key]) {
          leaveMap[key] = []
        }
        leaveMap[key].push(leave)
      }
    })

    const noteMap: Record<string, boolean> = {}
    shiftNotes.forEach((note: any) => {
      const dateOnly = formatDateForDB(new Date(note.shift_date))
      const key = `${note.shift_id}_${dateOnly}`
      noteMap[key] = true
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

    const directAssignmentMap: Record<string, any[]> = {}
    directAssignments.forEach((da: any) => {
      const dateOnly = formatDateForDB(new Date(da.shift_date))
      const key = `${dateOnly}_${da.shift_type}_${da.team_id}`
      if (!directAssignmentMap[key]) {
        directAssignmentMap[key] = []
      }
      directAssignmentMap[key].push(da)
    })

    console.log("[v0] Sample directAssignment for Nov 26:", directAssignmentMap["2025-11-26_day_2"]?.[0])

    const actingDesignationMap: Record<string, { isActingLieutenant: boolean; isActingCaptain: boolean }> = {}
    actingDesignations.forEach((ad: any) => {
      // Use cycle_day, shift_type, team_id, and user_id as key
      const key = `${ad.cycle_day}_${ad.shift_type}_${ad.team_id}_${ad.user_id}`
      actingDesignationMap[key] = {
        isActingLieutenant: ad.is_acting_lieutenant,
        isActingCaptain: ad.is_acting_captain,
      }
    })

    return (
      <div className="p-4 md:p-6">
        <ScrollToTodayOnNav />
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendrier des quarts</h1>
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

        <div className="relative">
          <div className="sticky top-32 -left-20 z-50 float-left">
            <CalendarMonthNavigation />
          </div>

          <CalendarView
            initialMonths={allMonthsDays}
            shiftsByCycleDay={shiftsByCycleDay}
            replacementMap={replacementMap}
            exchangeMap={exchangeMap}
            leaves={leaves}
            leaveMap={leaveMap}
            noteMap={noteMap}
            directAssignmentMap={directAssignmentMap}
            actingDesignationMap={actingDesignationMap}
            isAdmin={user.is_admin}
            cycleStartDate={cycleStartDate}
            currentYear={selectedYear}
            currentMonth={selectedMonth}
          />
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
