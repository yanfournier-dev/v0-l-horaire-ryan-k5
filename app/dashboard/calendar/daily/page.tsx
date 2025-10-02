import { getSession } from "@/lib/auth"
import { getAllShifts, getCycleConfig } from "@/app/actions/calendar"
import { getShiftAssignments } from "@/app/actions/shift-assignments"
import { redirect } from "next/navigation"
import { getCycleDay } from "@/lib/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { getShiftTypeColor, getShiftTypeLabel, getTeamColor } from "@/lib/colors"
import { FirefighterAssignmentCard } from "@/components/firefighter-assignment-card"

export default async function DailyViewPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  const cycleConfig = await getCycleConfig()
  if (!cycleConfig) {
    redirect("/dashboard/calendar")
  }

  const cycleStartDate = new Date(cycleConfig.start_date)
  const selectedDate = searchParams.date ? new Date(searchParams.date) : new Date()
  const currentCycleDay = getCycleDay(selectedDate, cycleStartDate)

  // Get all shifts for this cycle day
  const allShifts = await getAllShifts()
  const dayShifts = allShifts.filter((shift: any) => shift.cycle_day === currentCycleDay)

  // Get assignments for each shift
  const shiftsWithAssignments = await Promise.all(
    dayShifts.map(async (shift: any) => {
      const assignments = await getShiftAssignments(shift.id)
      return { ...shift, assignments }
    }),
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link href="/dashboard/calendar">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour au calendrier
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Vue quotidienne</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {selectedDate.toLocaleDateString("fr-CA", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              • Jour {currentCycleDay} du cycle
            </p>
          </div>

          <form method="GET" className="flex gap-2">
            <Input type="date" name="date" defaultValue={selectedDate.toISOString().split("T")[0]} className="w-auto" />
            <Button type="submit" variant="outline">
              Changer
            </Button>
          </form>
        </div>
      </div>

      {user.is_admin && (
        <Card className="mb-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              💡 Cliquez sur un pompier pour créer une demande de remplacement pour son quart
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {shiftsWithAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucun quart programmé pour ce jour</p>
            </CardContent>
          </Card>
        ) : (
          shiftsWithAssignments.map((shift: any) => (
            <Card key={shift.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Badge className={getTeamColor(shift.team_name, shift.color)}>{shift.team_name}</Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <Badge className={getShiftTypeColor(shift.shift_type)}>
                        {getShiftTypeLabel(shift.shift_type)}
                      </Badge>
                    </CardDescription>
                  </div>
                  {user.is_admin && (
                    <Link href={`/dashboard/calendar/manage?shiftId=${shift.id}`}>
                      <Button variant="outline" size="sm">
                        Gérer
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                      Pompiers assignés ({shift.assignments.length}/8)
                    </h3>
                    {shift.assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun pompier assigné</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {shift.assignments.map((assignment: any, index: number) => (
                          <FirefighterAssignmentCard
                            key={assignment.id}
                            assignment={assignment}
                            shift={{
                              id: shift.id,
                              shift_type: shift.shift_type,
                              team_id: shift.team_id,
                              team_name: shift.team_name,
                            }}
                            shiftDate={selectedDate.toISOString().split("T")[0]}
                            index={index}
                            isAdmin={user.is_admin}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
