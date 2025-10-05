import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { getAllShifts, getCycleConfig } from "@/app/actions/calendar"
import { getShiftAssignments } from "@/app/actions/shift-assignments"
import { getCycleDay } from "@/lib/calendar"
import { getShiftTypeColor, getShiftTypeLabel, getTeamColor } from "@/lib/colors"
import { CreateReplacementButton } from "@/components/create-replacement-button"
import { getRoleLabel } from "@/lib/role-labels"
import { parseLocalDate } from "@/lib/calendar"

export const dynamic = "force-dynamic"

export default async function ManageReplacementsPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const user = await getSession()
  if (!user?.is_admin) redirect("/dashboard/replacements")

  const cycleConfig = await getCycleConfig()
  if (!cycleConfig) {
    redirect("/dashboard/calendar")
  }

  const cycleStartDate = parseLocalDate(cycleConfig.start_date)
  const selectedDate = searchParams.date ? parseLocalDate(searchParams.date) : new Date()
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
        <Link href="/dashboard/replacements">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour aux remplacements
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Créer une demande de remplacement</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Sélectionnez un pompier assigné pour créer une demande de remplacement
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

      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Date sélectionnée:</strong>{" "}
          {selectedDate.toLocaleDateString("fr-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          • Jour {currentCycleDay} du cycle
        </p>
      </div>

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
                      <span className="ml-2 text-xs">
                        {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      Pompiers assignés ({shift.assignments.length}/8)
                    </h3>
                    {shift.assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun pompier assigné</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {shift.assignments.map((assignment: any) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {assignment.first_name} {assignment.last_name}
                              </p>
                              {assignment.role !== "firefighter" && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {getRoleLabel(assignment.role)}
                                </Badge>
                              )}
                            </div>
                            <CreateReplacementButton
                              userId={assignment.user_id}
                              userName={`${assignment.first_name} ${assignment.last_name}`}
                              shiftDate={selectedDate.toISOString().split("T")[0]}
                              shiftType={shift.shift_type}
                              teamId={shift.team_id}
                            />
                          </div>
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
