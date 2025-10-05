"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getShiftTypeColor, getShiftTypeLabel, getTeamColor } from "@/lib/colors"
import { ShiftAssignmentDrawer } from "@/components/shift-assignment-drawer"
import { getShiftWithAssignments } from "@/app/actions/calendar"
import { getTeamFirefighters } from "@/app/actions/shift-assignments"

interface CalendarCellProps {
  day: {
    date: Date
    cycleDay: number
    dayOfWeek: number
    isToday: boolean
    isCurrentMonth?: boolean
  }
  shifts: Array<{
    id: number
    team_id: number
    cycle_day: number
    shift_type: string
    start_time: string
    end_time: string
    team_name: string
    team_color?: string
    assigned_count: number
  }>
  isAdmin: boolean
}

function getDayOfWeekLabel(dayOfWeek: number): string {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
  return days[dayOfWeek]
}

export function CalendarCell({ day, shifts, isAdmin }: CalendarCellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [teamFirefighters, setTeamFirefighters] = useState<any[]>([])
  const [currentAssignments, setCurrentAssignments] = useState<any[]>([])

  const handleShiftClick = async (shift: any) => {
    if (!isAdmin) return

    const shiftDetails = await getShiftWithAssignments(shift.id)
    const firefighters = await getTeamFirefighters(shift.team_id)

    setSelectedShift({
      ...shiftDetails,
      date: day.date,
    })
    setTeamFirefighters(firefighters)
    setCurrentAssignments(shiftDetails?.assignments || [])
    setDrawerOpen(true)
  }

  const isCurrentMonth = day.isCurrentMonth !== undefined ? day.isCurrentMonth : true

  return (
    <>
      <Card
        className={`${day.isToday ? "ring-2 ring-red-600" : ""} ${!isCurrentMonth ? "opacity-50" : ""} hover:shadow-md transition-shadow`}
      >
        <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                {getDayOfWeekLabel(day.dayOfWeek)}
              </CardTitle>
              <CardDescription
                className={`text-base md:text-lg font-bold ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}
              >
                {day.date.getDate()}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              J{day.cycleDay}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2 md:pb-3 p-3 md:p-6 pt-0 space-y-2">
          {shifts.length > 0 ? (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className={`space-y-1 p-2 rounded border ${isAdmin ? "cursor-pointer hover:bg-accent" : ""}`}
                onClick={() => handleShiftClick(shift)}
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge className={`${getShiftTypeColor(shift.shift_type)} text-xs`}>
                    {getShiftTypeLabel(shift.shift_type).split(" ")[0]}
                  </Badge>
                  <Badge className={`${getTeamColor(shift.team_name, shift.team_color)} text-xs`}>
                    {shift.team_name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </p>
                <p className="text-xs font-medium">{shift.assigned_count}/8 pompiers</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Aucun quart</p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <ShiftAssignmentDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          shift={selectedShift}
          teamFirefighters={teamFirefighters}
          currentAssignments={currentAssignments}
        />
      )}
    </>
  )
}
