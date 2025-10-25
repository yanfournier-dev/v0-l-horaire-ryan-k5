import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { getTeams } from "@/app/actions/teams"
import { getAllShifts } from "@/app/actions/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CreateShiftDialog } from "@/components/create-shift-dialog"
import { DeleteShiftButton } from "@/components/delete-shift-button"

export const dynamic = "force-dynamic"

export default async function ManageCalendarPage() {
  const user = await getSession()

  if (!user?.is_admin) {
    redirect("/dashboard/calendar")
  }

  const teams = await getTeams()
  const shifts = await getAllShifts()

  const getShiftTypeLabel = (type: string) => {
    switch (type) {
      case "day":
        return "Jour (7h-17h)"
      case "night":
        return "Nuit (17h-7h)"
      case "full_24h":
        return "24h (7h-7h)"
      default:
        return type
    }
  }

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case "day":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "night":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "full_24h":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Group shifts by cycle day
  const shiftsByCycleDay = shifts.reduce((acc: any, shift: any) => {
    if (!acc[shift.cycle_day]) {
      acc[shift.cycle_day] = []
    }
    acc[shift.cycle_day].push(shift)
    return acc
  }, {})

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard/calendar">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour au calendrier
          </Button>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gérer les quarts de travail</h1>
            <p className="text-muted-foreground">Configurez les quarts pour chaque jour du cycle de 28 jours</p>
          </div>

          <CreateShiftDialog teams={teams} />
        </div>
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 28 }, (_, i) => i + 1).map((cycleDay) => {
          const dayShifts = shiftsByCycleDay[cycleDay] || []

          return (
            <Card key={cycleDay}>
              <CardHeader>
                <CardTitle className="text-lg">Jour {cycleDay}</CardTitle>
                <CardDescription>{dayShifts.length} quart(s) configuré(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {dayShifts.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {dayShifts.map((shift: any) => (
                      <div key={shift.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-foreground">{shift.team_name}</p>
                            <Badge className={`${getShiftTypeColor(shift.shift_type)} mt-1`}>
                              {getShiftTypeLabel(shift.shift_type)}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                        </p>
                        <DeleteShiftButton shiftId={shift.id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun quart configuré pour ce jour</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
