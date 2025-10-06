"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    assigned_firefighters?: string
  }>
  replacements: Array<any[]>
  leaves: Array<any>
  leaveMap: Record<string, any[]>
  dateStr: string
  isAdmin: boolean
}

function getDayOfWeekLabel(dayOfWeek: number): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  return days[dayOfWeek]
}

function getFirefighterLeave(userId: number, dateStr: string, leaveMap: Record<string, any[]>) {
  const key = `${dateStr}_${userId}`
  const dayLeaves = leaveMap[key] || []
  return dayLeaves.find((leave) => leave.start_time && leave.end_time) // Only return if it's a partial leave
}

export function CalendarCell({ day, shifts, replacements, leaves, leaveMap, dateStr, isAdmin }: CalendarCellProps) {
  if (day.date.getDate() === 24 && day.date.getMonth() === 9) {
    console.log("[v0] CalendarCell Oct 24 - leaves prop:", JSON.stringify(leaves, null, 2))
    console.log("[v0] CalendarCell Oct 24 - leaveMap prop:", JSON.stringify(leaveMap, null, 2))
  }

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [teamFirefighters, setTeamFirefighters] = useState<any[]>([])
  const [currentAssignments, setCurrentAssignments] = useState<any[]>([])

  const formatFirefighterName = (firstName: string, lastName: string) => {
    return `${lastName} ${firstName.charAt(0)}.`
  }

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
        <CardHeader className="pb-0.5 md:pb-1 p-1 md:p-2">
          <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">
            {getDayOfWeekLabel(day.dayOfWeek)}, {day.date.getDate()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1 md:p-2 pt-0 space-y-1 md:space-y-1.5">
          {shifts.length > 0 ? (
            shifts.map((shift, shiftIndex) => {
              const shiftReplacements = replacements[shiftIndex] || []

              if (day.date.getDate() === 24 && day.date.getMonth() === 9) {
                // October 24
                console.log("[v0] CalendarCell for Oct 24, shift:", shift.team_name, shift.shift_type)
                console.log("[v0] shiftReplacements:", JSON.stringify(shiftReplacements, null, 2))
              }

              // Parse firefighters from the shift
              const firefighters = shift.assigned_firefighters
                ? shift.assigned_firefighters.split(";").map((entry: string) => {
                    const [firstName, lastName, role] = entry.trim().split("|")
                    return { firstName, lastName, role }
                  })
                : []

              // Sort firefighters by role
              const roleOrder: Record<string, number> = {
                captain: 1,
                lieutenant: 2,
                pp1: 3,
                pp2: 4,
                pp3: 5,
                pp4: 6,
                pp5: 7,
                pp6: 8,
              }
              firefighters.sort((a, b) => {
                const orderA = roleOrder[a.role] || 9
                const orderB = roleOrder[b.role] || 9
                return orderA - orderB
              })

              return (
                <div
                  key={shift.id}
                  className={`space-y-0.5 p-1 md:p-1.5 rounded border ${isAdmin ? "cursor-pointer hover:bg-accent" : ""}`}
                  onClick={() => handleShiftClick(shift)}
                >
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge className={`${getShiftTypeColor(shift.shift_type)} text-[10px] md:text-xs`}>
                      {getShiftTypeLabel(shift.shift_type).split(" ")[0]}
                    </Badge>
                    <Badge className={`${getTeamColor(shift.team_name, shift.team_color)} text-[10px] md:text-xs`}>
                      {shift.team_name}
                    </Badge>
                  </div>
                  {firefighters.length > 0 ? (
                    <div className="text-[10px] md:text-xs leading-tight text-foreground space-y-0">
                      {firefighters.map((firefighter, index) => {
                        if (day.date.getDate() === 24 && day.date.getMonth() === 9) {
                          console.log("[v0] Checking firefighter:", firefighter)
                          console.log("[v0] Looking for replacement in:", shiftReplacements)
                        }

                        const replacement = shiftReplacements.find(
                          (r: any) =>
                            r.replaced_first_name === firefighter.firstName &&
                            r.replaced_last_name === firefighter.lastName &&
                            r.replaced_role === firefighter.role,
                        )

                        if (day.date.getDate() === 24 && day.date.getMonth() === 9) {
                          console.log("[v0] Replacement found:", replacement)
                        }

                        const firefighterLeave = leaves.find(
                          (leave: any) =>
                            leave.first_name === firefighter.firstName &&
                            leave.last_name === firefighter.lastName &&
                            leave.start_time &&
                            leave.end_time &&
                            new Date(leave.start_date) <= day.date &&
                            new Date(leave.end_date) >= day.date,
                        )

                        if (day.date.getDate() === 24 && day.date.getMonth() === 9 && firefighterLeave) {
                          console.log("[v0] Partial leave found for:", firefighter, "leave:", firefighterLeave)
                        }

                        const isAssignedReplacement =
                          replacement?.status === "assigned" && replacement?.replacement_first_name
                        const isPendingReplacement = replacement?.status === "pending"
                        const isApprovedNotAssigned =
                          replacement && replacement?.status !== "assigned" && replacement?.status !== "pending"

                        const displayFirstName = isAssignedReplacement
                          ? replacement.replacement_first_name
                          : firefighter.firstName
                        const displayLastName = isAssignedReplacement
                          ? replacement.replacement_last_name
                          : firefighter.lastName

                        const hasPartialReplacement =
                          replacement?.is_partial && replacement?.start_time && replacement?.end_time
                        const hasPartialLeave = !!firefighterLeave

                        if (day.date.getDate() === 24 && day.date.getMonth() === 9) {
                          console.log("[v0] Displaying:", {
                            original: `${firefighter.firstName} ${firefighter.lastName}`,
                            display: `${displayFirstName} ${displayLastName}`,
                            isAssignedReplacement,
                            isPendingReplacement,
                            hasPartialLeave,
                            hasPartialReplacement,
                            replacementTimes: hasPartialReplacement
                              ? `${replacement.start_time.slice(0, 5)}-${replacement.end_time.slice(0, 5)}`
                              : null,
                          })
                        }

                        return (
                          <div
                            key={index}
                            className={`truncate ${
                              isPendingReplacement && hasPartialReplacement
                                ? "font-bold bg-red-100 dark:bg-red-900 px-1 rounded"
                                : isPendingReplacement
                                  ? "font-bold bg-red-100 dark:bg-red-900 px-1 rounded"
                                  : isApprovedNotAssigned && hasPartialReplacement
                                    ? "font-bold bg-red-100 dark:bg-red-900 px-1 rounded"
                                    : isApprovedNotAssigned
                                      ? "font-bold bg-red-100 dark:bg-red-900 px-1 rounded"
                                      : isAssignedReplacement && hasPartialReplacement
                                        ? "font-bold bg-yellow-100 dark:bg-yellow-900 px-1 rounded"
                                        : isAssignedReplacement
                                          ? "font-bold bg-yellow-100 dark:bg-yellow-900 px-1 rounded"
                                          : ""
                            } ${hasPartialLeave && !replacement ? "bg-blue-100 dark:bg-blue-900 px-1 rounded" : ""}`}
                          >
                            {isPendingReplacement && (
                              <span className="text-red-700 dark:text-red-300 font-bold mr-0.5">?</span>
                            )}
                            {isAssignedReplacement && hasPartialReplacement && (
                              <span className="text-yellow-700 dark:text-yellow-300 font-bold mr-0.5">*</span>
                            )}
                            {formatFirefighterName(displayFirstName, displayLastName)}
                            {isPendingReplacement && hasPartialReplacement && (
                              <span className="ml-1 text-[9px] md:text-[10px] font-semibold text-red-700 dark:text-red-300">
                                ({replacement.start_time.slice(0, 5)}-{replacement.end_time.slice(0, 5)})
                              </span>
                            )}
                            {isApprovedNotAssigned && hasPartialReplacement && (
                              <span className="ml-1 text-[9px] md:text-[10px] font-semibold text-red-700 dark:text-red-300">
                                ({replacement.start_time.slice(0, 5)}-{replacement.end_time.slice(0, 5)})
                              </span>
                            )}
                            {isAssignedReplacement && hasPartialReplacement && (
                              <span className="ml-1 text-[9px] md:text-[10px] font-semibold text-yellow-700 dark:text-yellow-300">
                                ({replacement.start_time.slice(0, 5)}-{replacement.end_time.slice(0, 5)})
                              </span>
                            )}
                            {hasPartialLeave && (
                              <span className="ml-1 text-[9px] md:text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                ({firefighterLeave.start_time.slice(0, 5)}-{firefighterLeave.end_time.slice(0, 5)})
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] md:text-xs text-muted-foreground italic">Aucun pompier assigné</p>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-[10px] md:text-xs text-muted-foreground">Aucun quart</p>
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
          leaves={leaves}
          dateStr={dateStr}
        />
      )}
    </>
  )
}
