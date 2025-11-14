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
import { getShiftNote } from "@/app/actions/shift-notes"
import { FileText } from 'lucide-react'

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
    if (!isAdmin) {
      return
    }

    try {
      const shiftDetails = await getShiftWithAssignments(shift.id)

      const shiftIndex = shifts.findIndex((s) => s.id === shift.id)
      const shiftExchanges = exchanges[shiftIndex] || []

      setSelectedShift({
        ...shift,
        date: day.date,
        exchanges: shiftExchanges,
      })
      setTeamFirefighters(shiftDetails.teamFirefighters)
      setCurrentAssignments(shiftDetails.assignments)
      setDrawerOpen(true)
    } catch (error) {
      console.error("[v0] Error in handleShiftClick:", error)
    }
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
        className={`calendar-cell-landscape ${day.isToday ? "ring-1 ring-blue-400/50 shadow-md" : ""} ${!isCurrentMonth ? "opacity-40" : ""} hover:shadow-md transition-all duration-200 h-full border-border/50`}
      >
        <CardHeader className="card-header pb-1 p-1.5 md:pb-1.5 md:p-2.5 border-b border-border/30">
          <CardTitle className="date-header text-xs md:text-sm font-semibold text-foreground/90 flex items-center justify-between">
            <span className="md:hidden text-sm font-bold">
              {day.date.getDate()}/{day.date.getMonth() + 1}
            </span>
            
            <div className="hidden md:flex md:items-baseline md:gap-1.5">
              <span className="text-[10px] md:text-xs text-muted-foreground/80 font-normal">
                {getDayOfWeekLabel(day.dayOfWeek)}
              </span>
              <span className="text-sm md:text-base font-bold">
                {day.date.getDate()} {getMonthLabel(day.date.getMonth())}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="card-content p-1 md:p-2 space-y-1 md:space-y-1.5">
          {shifts.length > 0 ? (
            shifts.map((shift, shiftIndex) => {
              const shiftReplacements = replacements[shiftIndex] || []
              const shiftExchanges = exchanges[shiftIndex] || []

              const firefighters = shift.assigned_firefighters
                ? shift.assigned_firefighters.split(";").map((entry: string) => {
                    const [
                      firstName,
                      lastName,
                      role,
                      isExtra,
                      isPartial,
                      startTime,
                      endTime,
                      isActingLieutenant,
                      isActingCaptain,
                      isDirectAssignment,
                    ] = entry.trim().split("|")

                    const firefighterData = {
                      firstName,
                      lastName,
                      role,
                      isExtra: isExtra === "true",
                      isPartial: isPartial === "true",
                      startTime: startTime || null,
                      endTime: endTime || null,
                      isActingLieutenant:
                        isActingLieutenant === "true" ? true : isActingLieutenant === "false" ? false : null,
                      isActingCaptain: isActingCaptain === "true" ? true : isActingCaptain === "false" ? false : null,
                      isDirectAssignment: isDirectAssignment === "true",
                    }

                    return firefighterData
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
                if (a.isExtra !== b.isExtra) {
                  return a.isExtra ? 1 : -1
                }
                const orderA = roleOrder[a.role] || 9
                const orderB = roleOrder[b.role] || 9
                return orderA - orderB
              })

              const hasActingLieutenant = firefighters.some((f) => f.isActingLieutenant === true)
              const hasActingCaptain = firefighters.some((f) => f.isActingCaptain === true)

              const assignmentsWithLtBadge = firefighters.map((assignment: any) => {
                const calendarIndex = firefighters.findIndex(
                  (f) => f.firstName === assignment.first_name && f.lastName === assignment.last_name,
                )

                if (calendarIndex === -1) {
                  return {
                    ...assignment,
                    showsLtBadge: false,
                    showsCptBadge: false,
                    is_acting_lieutenant: false,
                    is_acting_captain: false,
                  }
                }

                const firefighter = firefighters[calendarIndex]
                const showsLtBadge =
                  firefighter.isActingLieutenant === true ||
                  (!hasActingLieutenant && firefighter.role === "lieutenant" && firefighter.isActingLieutenant !== true)

                const showsCptBadge =
                  firefighter.isActingCaptain === true ||
                  (!hasActingCaptain && firefighter.role === "captain" && firefighter.isActingCaptain !== true)

                return {
                  ...assignment,
                  showsLtBadge,
                  showsCptBadge,
                  is_acting_lieutenant: firefighter.isActingLieutenant === true,
                  is_acting_captain: firefighter.isActingCaptain === true,
                }
              })

              const replacementsByReplacedFirefighter = new Map<string, any[]>()
              
              shiftReplacements.forEach((r: any) => {
                if (r.status === "assigned" && r.replacement_first_name) {
                  const key = `${r.replaced_first_name}|${r.replaced_last_name}|${r.replaced_role}`
                  if (!replacementsByReplacedFirefighter.has(key)) {
                    replacementsByReplacedFirefighter.set(key, [])
                  }
                  replacementsByReplacedFirefighter.get(key)!.push(r)
                }
              })
              
              // These would have isDirectAssignment:true and would be the "Remplaçant 2" 
              // Look for firefighters that don't match any original team member roles
              firefighters.forEach((f: any) => {
                if (f.isDirectAssignment) {
                  // Try to find if this direct assignment is replacing someone
                  // by looking in shiftReplacements for a replacement of this role
                  const potentialReplaced = shiftReplacements.find((r: any) => 
                    r.replaced_role === f.role && r.status === "assigned"
                  )
                  
                  if (potentialReplaced) {
                    const key = `${potentialReplaced.replaced_first_name}|${potentialReplaced.replaced_last_name}|${potentialReplaced.replaced_role}`
                    if (!replacementsByReplacedFirefighter.has(key)) {
                      replacementsByReplacedFirefighter.set(key, [])
                    }
                    // Add this direct assignment as a replacement
                    replacementsByReplacedFirefighter.get(key)!.push({
                      ...potentialReplaced,
                      replacement_first_name: f.firstName,
                      replacement_last_name: f.lastName,
                      start_time: f.startTime,
                      end_time: f.endTime,
                      replacement_order: 2 // Mark as second replacement
                    })
                  }
                }
              })
              
              if (dateStr === '2025-11-12' && shift.shift_type === 'day') {
                console.log('[v0] Nov 12 day shift - replacementsByReplacedFirefighter:', 
                  Array.from(replacementsByReplacedFirefighter.entries()).map(([k, v]) => ({
                    key: k,
                    count: v.length,
                    replacements: v.map(r => ({
                      name: `${r.replacement_first_name} ${r.replacement_last_name}`,
                      times: `${r.start_time}-${r.end_time}`
                    }))
                  }))
                )
              }
              
              const firefightersToHide = new Set<string>()
              replacementsByReplacedFirefighter.forEach((replacements, key) => {
                if (replacements.length === 2) {
                  // This is a double replacement, hide both individual replacement firefighters
                  replacements.forEach((r: any) => {
                    const firefighterKey = `${r.replacement_first_name}|${r.replacement_last_name}`
                    firefightersToHide.add(firefighterKey)
                  })
                }
              })
              
              const displayItems: Array<{ type: 'firefighter' | 'double-replacement', data: any, role: string, index: number }> = []
              
              // Add all firefighters from the main list
              firefighters.forEach((firefighter, index) => {
                const firefighterKey = `${firefighter.firstName}|${firefighter.lastName}`
                const replacedKey = `${firefighter.firstName}|${firefighter.lastName}|${firefighter.role}`
                
                const hasDoubleReplacement = replacementsByReplacedFirefighter.has(replacedKey) && 
                  replacementsByReplacedFirefighter.get(replacedKey)!.length === 2
                
                if (!firefightersToHide.has(firefighterKey) && !hasDoubleReplacement) {
                  displayItems.push({
                    type: 'firefighter',
                    data: firefighter,
                    role: firefighter.role,
                    index
                  })
                } else if (hasDoubleReplacement) {
                  displayItems.push({
                    type: 'double-replacement',
                    data: { 
                      key: replacedKey, 
                      replacements: replacementsByReplacedFirefighter.get(replacedKey)! 
                    },
                    role: firefighter.role,
                    index
                  })
                }
              })
              
              Array.from(replacementsByReplacedFirefighter.entries()).forEach(([key, replacements]) => {
                if (replacements.length !== 2) return
                
                const [firstName, lastName, role] = key.split('|')
                
                // Check if this firefighter is already in the main firefighters list
                const isInMainList = firefighters.some((f) => 
                  f.firstName === firstName && f.lastName === lastName && f.role === role
                )
                
                if (!isInMainList) {
                  // Add at the position based on role
                  displayItems.push({
                    type: 'double-replacement',
                    data: { key, replacements },
                    role: role,
                    index: 999 // Temporary, will be sorted
                  })
                }
              })

              // Sort display items by role order
              displayItems.sort((a, b) => {
                if (a.type === 'firefighter' && a.data.isExtra !== (b.type === 'firefighter' && b.data.isExtra)) {
                  return (a.type === 'firefighter' && a.data.isExtra) ? 1 : -1
                }
                const orderA = roleOrder[a.role] || 9
                const orderB = roleOrder[b.role] || 9
                if (orderA !== orderB) return orderA - orderB
                // Keep original order for items with same role
                return a.index - b.index
              })

              return (
                <div
                  key={shift.id}
                  className={`shift-container space-y-0.5 md:space-y-1 p-1.5 md:p-2 rounded-md border ${isAdmin ? "cursor-pointer hover:bg-accent/30" : ""} transition-colors`}
                  style={{
                    backgroundColor: getTeamBackgroundColor(shift.team_name, shift.team_color),
                    borderColor: getTeamBorderColor(shift.team_name, shift.team_color),
                  }}
                  onClick={() => handleShiftClick(shift)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="shift-type-badge text-[6px] md:text-[10px] font-medium px-1 md:px-1.5 py-0"
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
                  {firefighters.length > 0 || displayItems.length > 0 ? (
                    <div className="text-[7px] md:text-xs leading-snug md:leading-relaxed text-foreground/80 space-y-0">
                      {displayItems.map((item, displayIndex) => {
                        if (item.type === 'double-replacement') {
                          const { key, replacements } = item.data
                          
                          // Sort replacements by start time
                          const sortedReplacements = [...replacements].sort((a: any, b: any) => {
                            if (a.start_time && b.start_time) {
                              return a.start_time.localeCompare(b.start_time)
                            }
                            if (!a.start_time) return 1
                            if (!b.start_time) return -1
                            return 0
                          })

                          const replacement1 = sortedReplacements[0]
                          const replacement2 = sortedReplacements[1]
                          
                          if (replacement1?.replacement_first_name && replacement2?.replacement_first_name) {
                            const initials1 = `${replacement1.replacement_first_name.charAt(0)}${replacement1.replacement_last_name.charAt(0)}`
                            const initials2 = `${replacement2.replacement_first_name.charAt(0)}${replacement2.replacement_last_name.charAt(0)}`
                            
                            return (
                              <div
                                key={`double-${key}-${displayIndex}`}
                                className="firefighter-name truncate py-0 md:py-0.5 font-semibold"
                              >
                                <span className="text-[6px] md:text-sm mr-1">🧑‍🚒🧑‍🚒</span>
                                {initials1} + {initials2}
                              </div>
                            )
                          }
                          
                          return null
                        }
                        
                        // type === 'firefighter'
                        const firefighter = item.data
                        const index = item.index

                        const replacement = shiftReplacements.find(
                          (r: any) =>
                            r.replaced_first_name === firefighter.firstName &&
                            r.replaced_last_name === firefighter.lastName &&
                            r.replaced_role === firefighter.role
                        )

                        const exchange = shiftExchanges.find((ex: any) => {
                          if (ex.type === "requester") {
                            return (
                              ex.requester_first_name === firefighter.firstName &&
                              ex.requester_last_name === firefighter.lastName &&
                              ex.requester_role === firefighter.role
                            )
                          } else {
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
                            displayFirstName = exchange.target_first_name
                            displayLastName = exchange.target_last_name
                            if (exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time) {
                              exchangePartialTimes = `${exchange.requester_start_time.slice(0, 5)}-${exchange.requester_end_time.slice(0, 5)}`
                            }
                          } else {
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

                        const replacementIsActingLieutenant = replacement?.replacement_is_acting_lieutenant === true
                        const replacementIsActingCaptain = replacement?.replacement_is_acting_captain === true

                        const showCptBadge =
                          firefighter.isActingCaptain === true ||
                          (!hasActingCaptain &&
                            firefighter.role === "captain" &&
                            firefighter.isActingCaptain !== true) ||
                          (isAssignedReplacement &&
                            replacement?.replaced_role === "captain" &&
                            !hasActingCaptain) ||
                          (isAssignedReplacement && replacementIsActingCaptain)

                        const showGreenCptBadge =
                          firefighter.isActingCaptain === true ||
                          (isAssignedReplacement &&
                            replacement?.replaced_role === "captain" &&
                            !hasActingCaptain) ||
                          (isAssignedReplacement && replacementIsActingCaptain)

                        const showLtBadge =
                          firefighter.isActingLieutenant === true ||
                          (!hasActingLieutenant &&
                            firefighter.role === "lieutenant" &&
                            firefighter.isActingLieutenant !== true) ||
                          (isAssignedReplacement &&
                            replacement?.replaced_role === "lieutenant" &&
                            !hasActingLieutenant) ||
                          (isAssignedReplacement && replacementIsActingLieutenant)

                        const showGreenLtBadge =
                          firefighter.isActingLieutenant === true ||
                          (isAssignedReplacement &&
                            replacement?.replaced_role === "lieutenant" &&
                            !hasActingLieutenant) ||
                          (isAssignedReplacement && replacementIsActingLieutenant)

                        const isDirectAssignment = firefighter.isDirectAssignment === true

                        return (
                          <div
                            key={index}
                            className={`firefighter-name truncate py-0 md:py-0.5 ${
                              isExchange
                                ? "font-semibold"
                                : isExtraFirefighter
                                  ? "font-semibold"
                                  : isPendingReplacement
                                    ? "italic"
                                    : isApprovedNotAssigned
                                      ? "italic"
                                      : isAssignedReplacement && !isDirectAssignment
                                        ? "font-semibold"
                                        : isDirectAssignment
                                          ? "font-bold"
                                          : ""
                            } ${hasPartialLeave && !replacement && !isExchange ? "bg-blue-50 dark:bg-blue-950/20 px-1 md:px-1.5 rounded text-blue-700 dark:text-blue-300" : ""}`}
                          >
                            {(hasPartialReplacement ||
                              hasExtraPartialTime ||
                              hasPartialLeave ||
                              (isDirectAssignment && firefighter.isPartial)) &&
                              !isExchange && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mr-1 align-middle" />
                              )}
                            {showCptBadge && (
                              <span
                                className={`role-badge text-[3px] md:text-[9px] font-semibold px-0 md:px-1 py-0 md:py-0.5 rounded border scale-50 md:scale-100 origin-left ${
                                  showGreenCptBadge
                                    ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                                    : "border-muted-foreground/20 bg-muted/30 text-muted-foreground"
                                } mr-0.5 md:mr-1`}
                              >
                                Cpt
                              </span>
                            )}
                            {showLtBadge && (
                              <span
                                className={`role-badge text-[3px] md:text-[9px] font-semibold px-0 md:px-1 py-0 md:py-0.5 rounded border scale-50 md:scale-100 origin-left ${
                                  showGreenLtBadge
                                    ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                                    : "border-muted-foreground/20 bg-muted/30 text-muted-foreground"
                                } mr-0.5 md:mr-1`}
                              >
                                Lt
                              </span>
                            )}
                            {isExchange && (
                              <span className="text-green-700 dark:text-green-500 mr-0.5 md:mr-1 text-[6px] md:text-sm font-extrabold inline-block">
                                ↔
                              </span>
                            )}
                            {isApprovedNotAssigned && !isExchange && (
                              <span className="text-gray-600 dark:text-gray-400 mr-0.5 md:mr-1 text-[6px] md:text-sm">⏳</span>
                            )}
                            {isAssignedReplacement && !isExchange && !isDirectAssignment && (
                              <span className="text-green-700 dark:text-green-500 mr-0.5 md:mr-1 text-[6px] md:text-sm font-bold inline-block">
                                ✓
                              </span>
                            )}
                            {isExtraFirefighter && !isExchange && (
                              <span className="inline-block scale-100 md:scale-125 text-green-700 dark:text-green-500 mr-0.5 md:mr-1 text-[6px] md:text-sm">
                                +
                              </span>
                            )}
                            {displayFirstName === "Pompier" && displayLastName === "supplémentaire"
                              ? "Pompier supplémentaire"
                              : formatFirefighterName(displayFirstName, displayLastName)}
                            {isExchange && exchangePartialTimes && (
                              <span className="time-indicator ml-0.5 md:ml-1 text-[6px] md:text-[10px] font-normal text-gray-600 dark:text-gray-400">
                                ({exchangePartialTimes})
                              </span>
                            )}
                            {hasPartialReplacement && !isExchange && (
                              <span className="time-indicator ml-0.5 md:ml-1 text-[6px] md:text-[10px] font-normal text-gray-600 dark:text-gray-400">
                                ({replacement.start_time.slice(0, 5)}-{replacement.end_time.slice(0, 5)})
                              </span>
                            )}
                            {hasExtraPartialTime && !isExchange && (
                              <span className="time-indicator ml-0.5 md:ml-1 text-[6px] md:text-[10px] font-normal text-amber-600 dark:text-amber-400">
                                ({firefighter.startTime!.slice(0, 5)}-{firefighter.endTime!.slice(0, 5)})
                              </span>
                            )}
                            {hasPartialLeave && !isExchange && (
                              <span className="time-indicator ml-0.5 md:ml-1 text-[6px] md:text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                ({firefighterLeave.start_time.slice(0, 5)}-{firefighterLeave.end_time.slice(0, 5)})
                              </span>
                            )}
                            {isDirectAssignment &&
                              firefighter.isPartial &&
                              firefighter.startTime &&
                              firefighter.endTime && (
                                <span className="time-indicator ml-0.5 md:ml-1 text-[6px] md:text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                  ({firefighter.startTime.slice(0, 5)}-{firefighter.endTime.slice(0, 5)})
                                </span>
                              )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[7px] md:text-xs text-muted-foreground/60 italic">Aucun pompier assigné</p>
                  )}
                  {shift.has_note && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-0.5 md:mt-1 h-5 md:h-6 text-[7px] md:text-xs font-semibold text-foreground hover:text-foreground hover:bg-accent/50"
                      onClick={(e) => handleNoteClick(shift, e)}
                    >
                      <FileText className="h-2 md:h-3 w-2 md:w-3 md:mr-1" />
                      <span className="hidden md:inline">Voir la note</span>
                    </Button>
                  )}
                  {!shift.has_note && isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-0.5 md:mt-1 h-5 md:h-6 text-[7px] md:text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-40 hover:opacity-70"
                      onClick={(e) => handleNoteClick(shift, e)}
                    >
                      Note
                    </Button>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-[7px] md:text-xs text-muted-foreground/60 text-center py-2 md:py-4">Aucun quart</p>
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
