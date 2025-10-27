"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getShiftTypeLabel } from "@/lib/colors"
import { ShiftAssignmentDrawer } from "@/components/shift-assignment-drawer"
import { ShiftNoteDialog } from "@/components/shift-note-dialog"
import { getShiftWithAssignments } from "@/app/actions/calendar"
import { getTeamFirefighters } from "@/app/actions/shift-assignments"
import { getShiftNote } from "@/app/actions/shift-notes"
import { FileText } from "lucide-react"

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
    has_note: boolean // New prop to indicate if a shift has a note
  }>
  replacements: Array<any[]>
  exchanges: Array<any[]> // Add exchanges prop
  leaves: Array<any>
  leaveMap: Record<string, any[]>
  dateStr: string
  isAdmin: boolean
}

function getDayOfWeekLabel(dayOfWeek: number): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  return days[dayOfWeek]
}

function getMonthLabel(month: number): string {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  return months[month]
}

function getFirefighterLeave(userId: number, dateStr: string, leaveMap: Record<string, any[]>) {
  const key = `${dateStr}_${userId}`
  const dayLeaves = leaveMap[key] || []
  return dayLeaves.find((leave) => leave.start_time && leave.end_time) // Only return if it's a partial leave
}

export function CalendarCell({
  day,
  shifts,
  replacements,
  exchanges,
  leaves,
  leaveMap,
  dateStr,
  isAdmin,
}: CalendarCellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [teamFirefighters, setTeamFirefighters] = useState<any[]>([])
  const [currentAssignments, setCurrentAssignments] = useState<any[]>([])
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [selectedShiftForNote, setSelectedShiftForNote] = useState<any>(null)
  const [currentNote, setCurrentNote] = useState<any>(null)

  const formatFirefighterName = (firstName: string, lastName: string) => {
    return `${lastName} ${firstName.charAt(0)}.`
  }

  const handleShiftClick = async (shift: any) => {
    if (!isAdmin) return

    const shiftDetails = await getShiftWithAssignments(shift.id)
    const firefighters = await getTeamFirefighters(shift.team_id)

    const shiftIndex = shifts.findIndex((s) => s.id === shift.id)
    const shiftExchanges = exchanges[shiftIndex] || []

    setSelectedShift({
      ...shiftDetails,
      date: day.date,
      exchanges: shiftExchanges,
    })
    setTeamFirefighters(firefighters)
    setCurrentAssignments(shiftDetails?.assignments || [])
    setDrawerOpen(true)
  }

  const handleNoteClick = async (shift: any, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent shift click handler from firing

    const note = await getShiftNote(shift.id, dateStr)
    setCurrentNote(note)
    setSelectedShiftForNote(shift)
    setNoteDialogOpen(true)
  }

  const isCurrentMonth = day.isCurrentMonth !== undefined ? day.isCurrentMonth : true

  const getTeamBackgroundColor = (teamName: string, teamColor?: string) => {
    if (teamColor) {
      return `${teamColor}15` // Increased from 08 to 15 (8% to ~21% opacity)
    }

    // Fallback for teams without color
    if (teamName.includes("1")) return "rgba(58, 175, 74, 0.15)" // #3aaf4a with 15% opacity
    if (teamName.includes("2")) return "rgb(59, 130, 246, 0.15)" // blue with 15% opacity (was 0.08)
    if (teamName.includes("3")) return "rgba(254, 197, 46, 0.25)" // #fec52e with 25% opacity
    if (teamName.includes("4")) return "rgba(227, 6, 19, 0.15)" // #E30613 with 15% opacity
    return "transparent"
  }

  const getTeamBorderColor = (teamName: string, teamColor?: string) => {
    if (teamColor) {
      return `${teamColor}40` // Increased from 20 to 40 (~25% to ~50% opacity)
    }

    // Fallback for teams without color
    if (teamName.includes("1")) return "rgba(58, 175, 74, 0.4)" // #3aaf4a with 40% opacity
    if (teamName.includes("2")) return "rgb(59, 130, 246, 0.4)" // blue with 40% opacity (was 0.25)
    if (teamName.includes("3")) return "rgba(254, 197, 46, 0.5)" // #fec52e with 50% opacity
    if (teamName.includes("4")) return "rgba(227, 6, 19, 0.4)" // #E30613 with 40% opacity
    return "rgb(229, 231, 235, 0.5)"
  }

  return (
    <>
      <Card
        id={`day-${dateStr}`}
        className={`${day.isToday ? "ring-1 ring-blue-400/50 shadow-md" : ""} ${!isCurrentMonth ? "opacity-40" : ""} hover:shadow-md transition-all duration-200 h-full border-border/50`}
      >
        <CardHeader className="pb-1.5 p-2.5 border-b border-border/30">
          <CardTitle className="text-sm font-semibold text-foreground/90 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/80 font-normal">{getDayOfWeekLabel(day.dayOfWeek)}</span>
            <span className="text-base font-bold">
              {day.date.getUTCDate()} {getMonthLabel(day.date.getUTCMonth())}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-1.5">
          {shifts.length > 0 ? (
            shifts.map((shift, shiftIndex) => {
              const shiftReplacements = replacements[shiftIndex] || []
              const shiftExchanges = exchanges[shiftIndex] || []

              // Parse firefighters from the shift
              const firefighters = shift.assigned_firefighters
                ? shift.assigned_firefighters.split(";").map((entry: string) => {
                    const [firstName, lastName, role, isExtra, isPartial, startTime, endTime] = entry.trim().split("|")
                    return {
                      firstName,
                      lastName,
                      role,
                      isExtra: isExtra === "true",
                      isPartial: isPartial === "true",
                      startTime: startTime || null,
                      endTime: endTime || null,
                    }
                  })
                : []

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
                // First, sort by isExtra (false comes before true)
                if (a.isExtra !== b.isExtra) {
                  return a.isExtra ? 1 : -1
                }
                // Then sort by role within each group
                const orderA = roleOrder[a.role] || 9
                const orderB = roleOrder[b.role] || 9
                return orderA - orderB
              })

              return (
                <div
                  key={shift.id}
                  className={`space-y-1 p-2 rounded-md border ${isAdmin ? "cursor-pointer hover:bg-accent/30" : ""} transition-colors`}
                  style={{
                    backgroundColor: getTeamBackgroundColor(shift.team_name, shift.team_color),
                    borderColor: getTeamBorderColor(shift.team_name, shift.team_color),
                  }}
                  onClick={() => handleShiftClick(shift)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium px-1.5 py-0"
                      style={{
                        backgroundColor:
                          shift.shift_type === "full_24h"
                            ? "rgba(0, 70, 65, 0.12)"
                            : shift.shift_type === "day"
                              ? "rgb(186, 230, 253)"
                              : "rgb(254, 205, 211)",
                        color:
                          shift.shift_type === "full_24h"
                            ? "#004641"
                            : shift.shift_type === "day"
                              ? "rgb(7, 89, 133)"
                              : "rgb(159, 18, 57)",
                        borderColor:
                          shift.shift_type === "full_24h"
                            ? "rgba(0, 70, 65, 0.4)"
                            : shift.shift_type === "day"
                              ? "rgb(56, 189, 248)"
                              : "rgb(251, 113, 133)",
                      }}
                    >
                      {getShiftTypeLabel(shift.shift_type).split(" ")[0]}
                    </Badge>
                  </div>
                  {firefighters.length > 0 ? (
                    <div className="text-xs leading-relaxed text-foreground/80 space-y-0">
                      {firefighters.map((firefighter, index) => {
                        const replacement = shiftReplacements.find(
                          (r: any) =>
                            r.replaced_first_name === firefighter.firstName &&
                            r.replaced_last_name === firefighter.lastName &&
                            r.replaced_role === firefighter.role,
                        )

                        const exchange = shiftExchanges.find((ex: any) => {
                          if (ex.type === "requester") {
                            // This is the requester's original shift, so target is taking their place
                            return (
                              ex.requester_first_name === firefighter.firstName &&
                              ex.requester_last_name === firefighter.lastName &&
                              ex.requester_role === firefighter.role
                            )
                          } else {
                            // This is the target's original shift, so requester is taking their place
                            return (
                              ex.target_first_name === firefighter.firstName &&
                              ex.target_last_name === firefighter.lastName &&
                              ex.target_role === firefighter.role
                            )
                          }
                        })

                        const firefighterLeave = leaves.find(
                          (leave: any) =>
                            leave.first_name === firefighter.firstName &&
                            leave.last_name === firefighter.lastName &&
                            leave.start_time &&
                            leave.end_time &&
                            new Date(leave.start_date) <= day.date &&
                            new Date(leave.end_date) >= day.date,
                        )

                        const isAssignedReplacement =
                          replacement?.status === "assigned" && replacement?.replacement_first_name
                        const isPendingReplacement = replacement?.status === "pending"
                        const isApprovedNotAssigned =
                          replacement && replacement?.status !== "assigned" && replacement?.status !== "pending"

                        let displayFirstName = firefighter.firstName
                        let displayLastName = firefighter.lastName
                        let isExchange = false
                        let exchangePartialTimes = null

                        if (exchange) {
                          isExchange = true
                          if (exchange.type === "requester") {
                            // Target is taking requester's place
                            displayFirstName = exchange.target_first_name
                            displayLastName = exchange.target_last_name
                            if (exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time) {
                              exchangePartialTimes = `${exchange.requester_start_time.slice(0, 5)}-${exchange.requester_end_time.slice(0, 5)}`
                            }
                          } else {
                            // Requester is taking target's place
                            displayFirstName = exchange.requester_first_name
                            displayLastName = exchange.requester_last_name
                            if (exchange.is_partial && exchange.target_start_time && exchange.target_end_time) {
                              exchangePartialTimes = `${exchange.target_start_time.slice(0, 5)}-${exchange.target_end_time.slice(0, 5)}`
                            }
                          }
                        } else if (isAssignedReplacement) {
                          displayFirstName = replacement.replacement_first_name
                          displayLastName = replacement.replacement_last_name
                        }

                        const hasPartialReplacement =
                          replacement?.is_partial && replacement?.start_time && replacement?.end_time
                        const hasPartialLeave = !!firefighterLeave

                        const isExtraFirefighter = firefighter.isExtra
                        const hasExtraPartialTime =
                          isExtraFirefighter && firefighter.isPartial && firefighter.startTime && firefighter.endTime

                        return (
                          <div
                            key={index}
                            className={`truncate py-0.5 ${
                              isExchange
                                ? "font-semibold"
                                : isExtraFirefighter
                                  ? "font-semibold" // Changed from font-medium to font-semibold for extra firefighters
                                  : isPendingReplacement
                                    ? "italic"
                                    : isApprovedNotAssigned
                                      ? "italic"
                                      : isAssignedReplacement
                                        ? "font-semibold"
                                        : ""
                            } ${hasPartialLeave && !replacement && !isExchange ? "bg-blue-50 dark:bg-blue-950/20 px-1.5 rounded text-blue-700 dark:text-blue-300" : ""}`}
                          >
                            {isExchange && <span className="text-green-700 dark:text-green-500 mr-1">↔</span>}
                            {isApprovedNotAssigned && !isExchange && (
                              <span className="text-gray-600 dark:text-gray-400 mr-1">⏳</span>
                            )}
                            {isAssignedReplacement && !isExchange && (
                              <span className="text-green-700 dark:text-green-500 mr-1">✓</span>
                            )}
                            {isExtraFirefighter && !isExchange && (
                              <span className="inline-block scale-125 text-green-700 dark:text-green-500 mr-1">+</span>
                            )}
                            {hasExtraPartialTime && !isExchange && (
                              <span className="text-amber-500 dark:text-amber-400 font-bold mr-1">*</span>
                            )}
                            {displayFirstName === "Pompier" && displayLastName === "supplémentaire"
                              ? "Pompier supplémentaire"
                              : formatFirefighterName(displayFirstName, displayLastName)}
                            {isExchange && exchangePartialTimes && (
                              <span className="ml-1 text-[10px] font-normal text-gray-600 dark:text-gray-400">
                                ({exchangePartialTimes})
                              </span>
                            )}
                            {hasPartialReplacement && !isExchange && (
                              <span className="ml-1 text-[10px] font-normal text-gray-600 dark:text-gray-400">
                                ({replacement.start_time.slice(0, 5)}-{replacement.end_time.slice(0, 5)})
                              </span>
                            )}
                            {hasExtraPartialTime && !isExchange && (
                              <span className="ml-1 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                                ({firefighter.startTime!.slice(0, 5)}-{firefighter.endTime!.slice(0, 5)})
                              </span>
                            )}
                            {hasPartialLeave && !isExchange && (
                              <span className="ml-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                ({firefighterLeave.start_time.slice(0, 5)}-{firefighterLeave.end_time.slice(0, 5)})
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">Aucun pompier assigné</p>
                  )}
                  {shift.has_note && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 h-6 text-xs font-semibold text-foreground hover:text-foreground hover:bg-accent/50"
                      onClick={(e) => handleNoteClick(shift, e)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Voir la note
                    </Button>
                  )}
                  {!shift.has_note && isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 h-6 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-40 hover:opacity-70"
                      onClick={(e) => handleNoteClick(shift, e)}
                    >
                      Note
                    </Button>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-xs text-muted-foreground/60 text-center py-4">Aucun quart</p>
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
          isAdmin={isAdmin} // Added isAdmin prop to enable admin features in drawer
        />
      )}

      {selectedShiftForNote && (
        <ShiftNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          shiftId={selectedShiftForNote.id}
          shiftDate={dateStr}
          teamName={selectedShiftForNote.team_name}
          shiftType={selectedShiftForNote.shift_type}
          existingNote={currentNote}
          isAdmin={isAdmin}
        />
      )}
    </>
  )
}
