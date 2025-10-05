import { getSession } from "@/lib/auth"
import { getCycleConfig, getAllShiftsWithAssignments } from "@/app/actions/calendar"
import { redirect } from "next/navigation"
import { generateMonthView, getCycleDay, getMonthName, parseLocalDate } from "@/lib/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarCell } from "@/components/calendar-cell"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  try {
    console.log("[v0] Calendar page: Starting to load")

    const user = await getSession()
    console.log("[v0] Calendar page: User session retrieved", { userId: user?.id, isAdmin: user?.is_admin })

    if (!user) redirect("/login")

    const cycleConfig = await getCycleConfig()
    console.log("[v0] Calendar page: Cycle config retrieved", { hasConfig: !!cycleConfig })

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
    console.log("[v0] Calendar page: Cycle start date parsed", { cycleStartDate: cycleStartDate.toISOString() })

    const today = new Date()

    const selectedYear = searchParams.year ? Number.parseInt(searchParams.year) : today.getFullYear()
    const selectedMonth = searchParams.month ? Number.parseInt(searchParams.month) : today.getMonth()
    console.log("[v0] Calendar page: Selected date", { selectedYear, selectedMonth })

    const currentCycleDay = getCycleDay(today, cycleStartDate)
    console.log("[v0] Calendar page: Current cycle day", { currentCycleDay })

    const days = generateMonthView(selectedYear, selectedMonth, cycleStartDate)
    console.log("[v0] Calendar page: Month view generated", { daysCount: days.length })

    console.log("[v0] Calendar page: About to fetch all shifts")
    const allShifts = await getAllShiftsWithAssignments()
    console.log("[v0] Calendar page: All shifts fetched", { shiftsCount: allShifts.length })

    const shiftsByCycleDay: Record<number, any[]> = {}
    allShifts.forEach((shift: any) => {
      if (!shiftsByCycleDay[shift.cycle_day]) {
        shiftsByCycleDay[shift.cycle_day] = []
      }
      shiftsByCycleDay[shift.cycle_day].push(shift)
    })
    console.log("[v0] Calendar page: Shifts organized by cycle day", {
      cycleDaysCount: Object.keys(shiftsByCycleDay).length,
    })

    const getDayOfWeekLabel = (dayOfWeek: number) => {
      const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
      return days[dayOfWeek]
    }

    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear

    const yearOptions = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i)

    console.log("[v0] Calendar page: About to render")

    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {getMonthName(selectedMonth)} {selectedYear}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Aujourd'hui: Jour {currentCycleDay} du cycle • Début: {cycleStartDate.toLocaleDateString("fr-CA")}
              </p>
            </div>

            <div className="flex gap-2">
              <Link href="/dashboard/calendar/daily">
                <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                  Vue quotidienne
                </Button>
              </Link>
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

          <div className="grid grid-cols-7 gap-2 md:gap-3">
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:gap-3 grid-cols-7">
          {days.map((day, index) => {
            const shifts = shiftsByCycleDay[day.cycleDay] || []

            return (
              <CalendarCell
                key={index}
                day={day}
                shifts={shifts}
                isAdmin={user.is_admin}
                getDayOfWeekLabel={getDayOfWeekLabel}
              />
            )
          })}
        </div>
      </div>
    )
  } catch (error) {
    console.error("[v0] Calendar page error:", error)
    console.error("[v0] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })

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
