"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CalendarCell } from "@/components/calendar-cell"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown } from "lucide-react"
import { generateMonthView, getMonthName } from "@/lib/calendar"
import { getCurrentLocalDate, formatLocalDate, formatDateForDB } from "@/lib/date-utils"
import { getCalendarDataForDateRange } from "@/app/actions/calendar"

interface CalendarViewProps {
  initialMonths: Array<{
    year: number
    month: number
    days: any[]
  }>
  shiftsByCycleDay: Record<number, any[]>
  replacementMap: Record<string, any[]>
  exchangeMap: Record<string, any[]>
  leaves: any[]
  leaveMap: Record<string, any[]>
  noteMap: Record<string, boolean> // Add noteMap prop
  directAssignmentMap: Record<string, any[]> // Adding directAssignmentMap prop
  extraFirefighterMap: Record<string, any[]> // Added prop for extra firefighters
  actingDesignationMap: Record<string, { isActingLieutenant: boolean; isActingCaptain: boolean }> // Adding actingDesignationMap prop
  isAdmin: boolean
  cycleStartDate: Date
  currentYear: number
  currentMonth: number
  onReplacementCreated?: () => void
}

export function CalendarView({
  initialMonths,
  shiftsByCycleDay,
  replacementMap: initialReplacementMap,
  exchangeMap: initialExchangeMap,
  leaves: initialLeaves,
  leaveMap: initialLeaveMap,
  noteMap: initialNoteMap,
  directAssignmentMap: initialDirectAssignmentMap, // Adding state for directAssignmentMap
  actingDesignationMap: initialActingDesignationMap, // Adding state for actingDesignationMap
  extraFirefighterMap: initialExtraFirefighterMap, // Receiving extra firefighters map
  isAdmin,
  cycleStartDate,
  currentYear,
  currentMonth,
  onReplacementCreated,
}: CalendarViewProps) {
  const [months, setMonths] = useState(initialMonths)
  const [replacementMap, setReplacementMap] = useState(initialReplacementMap)
  const [exchangeMap, setExchangeMap] = useState(initialExchangeMap)
  const [leaves, setLeaves] = useState(initialLeaves)
  const [leaveMap, setLeaveMap] = useState(initialLeaveMap)
  const [noteMap, setNoteMap] = useState(initialNoteMap)
  const [directAssignmentMap, setDirectAssignmentMap] = useState(initialDirectAssignmentMap) // Adding state for directAssignmentMap
  const [actingDesignationMap, setActingDesignationMap] = useState(initialActingDesignationMap) // Adding state for actingDesignationMap
  const [extraFirefighterMap, setExtraFirefighterMap] = useState(initialExtraFirefighterMap) // Added state for extra firefighters
  const [loading, setLoading] = useState(false)
  const scrollAnchorRef = useRef<string | null>(null)
  const router = useRouter() // Adding router to refresh server component

  const todayStr = getCurrentLocalDate()

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null
    let restoreInterval: NodeJS.Timeout | null = null
    let currentlyRestoring = false // Local flag to prevent duplicate processing

    const checkAndRestore = () => {
      if (currentlyRestoring) {
        return
      }

      const skipFlag = sessionStorage.getItem("skip-scroll-to-today")
      const savedScrollPosition = sessionStorage.getItem("calendar-scroll-position")

      if (skipFlag && savedScrollPosition) {
        currentlyRestoring = true

        // Immediately consume BOTH flags
        sessionStorage.removeItem("skip-scroll-to-today")
        sessionStorage.removeItem("calendar-scroll-position")

        const scrollPos = Number.parseInt(savedScrollPosition, 10)
        console.log("[v0] CalendarView - restoring scroll to:", scrollPos)

        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            window.scrollTo(0, scrollPos)
          }, i * 10)
        }

        const startTime = Date.now()
        let restoreCount = 0

        if (restoreInterval) {
          clearInterval(restoreInterval)
        }

        restoreInterval = setInterval(() => {
          const elapsed = Date.now() - startTime
          if (elapsed > 3000) {
            if (restoreInterval) {
              clearInterval(restoreInterval)
              restoreInterval = null
            }
            console.log("[v0] CalendarView - scroll restoration complete after", restoreCount, "corrections")
            currentlyRestoring = false
            return
          }

          const currentScroll = window.scrollY
          if (Math.abs(currentScroll - scrollPos) > 5) {
            restoreCount++
            window.scrollTo(0, scrollPos)
          }
        }, 10)
      }
    }

    // Check immediately on mount
    checkAndRestore()

    pollInterval = setInterval(() => {
      checkAndRestore()
    }, 100)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (restoreInterval) clearInterval(restoreInterval)
    }
  }, []) // Empty deps - only setup once

  const loadPreviousMonths = async () => {
    setLoading(true)

    const scrollBeforeLoad = window.scrollY
    const heightBeforeLoad = document.documentElement.scrollHeight
    console.log("[v0] Before load - scroll:", scrollBeforeLoad, "height:", heightBeforeLoad)

    const firstMonth = months[0]
    scrollAnchorRef.current = `month-${firstMonth.year}-${firstMonth.month}`

    const newMonths = []

    for (let i = 3; i > 0; i--) {
      const targetMonth = firstMonth.month - i
      const targetYear = firstMonth.year + Math.floor(targetMonth / 12)
      const normalizedMonth = ((targetMonth % 12) + 12) % 12

      newMonths.push({
        year: targetYear,
        month: normalizedMonth,
        days: generateMonthView(targetYear, normalizedMonth, cycleStartDate),
      })
    }

    const firstDay = newMonths[0].days[0]?.date
    const lastDay = newMonths[newMonths.length - 1].days[newMonths[newMonths.length - 1].days.length - 1]?.date

    if (firstDay && lastDay) {
      const data = await getCalendarDataForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay))

      const newReplacementMap = { ...replacementMap }
      if (data.replacements && Array.isArray(data.replacements)) {
        data.replacements.forEach((repl: any) => {
          const dateOnly = formatLocalDate(repl.shift_date)
          const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
          if (!newReplacementMap[key]) {
            newReplacementMap[key] = []
          }
          newReplacementMap[key].push(repl)
        })
      }
      setReplacementMap(newReplacementMap)

      const newExchangeMap = { ...exchangeMap }
      if (data.exchanges && Array.isArray(data.exchanges)) {
        data.exchanges.forEach((exchange: any) => {
          const requesterDateOnly = formatLocalDate(exchange.requester_shift_date)
          const requesterKey = `${requesterDateOnly}_${exchange.requester_shift_type}_${exchange.requester_team_id}`
          if (!newExchangeMap[requesterKey]) {
            newExchangeMap[requesterKey] = []
          }
          newExchangeMap[requesterKey].push({ ...exchange, type: "requester" })

          const targetDateOnly = formatLocalDate(exchange.target_shift_date)
          const targetKey = `${targetDateOnly}_${exchange.target_shift_type}_${exchange.target_team_id}`
          if (!newExchangeMap[targetKey]) {
            newExchangeMap[targetKey] = []
          }
          newExchangeMap[targetKey].push({ ...exchange, type: "target" })
        })
      }
      setExchangeMap(newExchangeMap)

      const newLeaveMap = { ...leaveMap }
      if (data.leaves && Array.isArray(data.leaves)) {
        data.leaves.forEach((leave: any) => {
          const startDate = new Date(leave.start_date)
          const endDate = new Date(leave.end_date)
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateForDB(d)
            const key = `${dateStr}_${leave.user_id}`
            if (!newLeaveMap[key]) {
              newLeaveMap[key] = []
            }
            newLeaveMap[key].push(leave)
          }
        })
        setLeaves([...leaves, ...data.leaves])
      }
      setLeaveMap(newLeaveMap)

      if (data.notes && Array.isArray(data.notes)) {
        const newNoteMap = { ...noteMap }
        data.notes.forEach((note: any) => {
          const dateOnly = formatLocalDate(note.shift_date)
          const key = `${note.shift_id}_${dateOnly}`
          newNoteMap[key] = true
        })
        setNoteMap(newNoteMap)
      }

      const newDirectAssignmentMap = { ...directAssignmentMap }
      if (data.direct_assignments && Array.isArray(data.direct_assignments)) {
        data.direct_assignments.forEach((assignment: any) => {
          const dateOnly = formatLocalDate(assignment.shift_date)
          const key = `${dateOnly}_${assignment.shift_type}_${assignment.team_id}`
          if (!newDirectAssignmentMap[key]) {
            newDirectAssignmentMap[key] = []
          }
          newDirectAssignmentMap[key].push(assignment)
        })
      }
      setDirectAssignmentMap(newDirectAssignmentMap)

      const newActingDesignationMap: Record<string, { isActingLieutenant: boolean; isActingCaptain: boolean }> = {}
      if (data.acting_designations && Array.isArray(data.acting_designations)) {
        data.acting_designations.forEach((ad: any) => {
          const dateStr = ad.shift_date ? formatLocalDate(ad.shift_date) : null
          if (dateStr) {
            let key: string
            if (ad.is_direct_assignment && ad.replaced_user_id) {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_direct_${ad.replaced_user_id}`
            } else {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_original`
            }
            console.log("[v0] actingDesignationMap adding key:", key, "with values:", {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
            })
            newActingDesignationMap[key] = {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
            }
          }
        })
      }
      console.log("[v0] handleShiftUpdated - new actingDesignationMap keys:", Object.keys(newActingDesignationMap))
      setActingDesignationMap(newActingDesignationMap)

      const newExtraFirefighterMap = { ...extraFirefighterMap }
      if (data.extra_firefighters && Array.isArray(data.extra_firefighters)) {
        data.extra_firefighters.forEach((extra: any) => {
          const dateOnly = formatLocalDate(extra.shift_date)
          const key = `${dateOnly}_${extra.shift_type}_${extra.team_id}`
          if (!newExtraFirefighterMap[key]) {
            newExtraFirefighterMap[key] = []
          }
          newExtraFirefighterMap[key].push(extra)
        })
      }
      setExtraFirefighterMap(newExtraFirefighterMap)
    }

    setMonths([...newMonths, ...months])
    setLoading(false)

    setTimeout(() => {
      const heightAfterLoad = document.documentElement.scrollHeight
      const addedHeight = heightAfterLoad - heightBeforeLoad
      const newScrollPosition = scrollBeforeLoad + addedHeight

      console.log("[v0] After load - added height:", addedHeight, "new scroll:", newScrollPosition)
      window.scrollTo(0, newScrollPosition)

      scrollAnchorRef.current = null
    }, 50)
  }

  const loadNextMonths = async () => {
    setLoading(true)
    const lastMonth = months[months.length - 1]
    const newMonths = []

    for (let i = 1; i <= 3; i++) {
      const targetMonth = lastMonth.month + i
      const targetYear = lastMonth.year + Math.floor(targetMonth / 12)
      const normalizedMonth = targetMonth % 12

      newMonths.push({
        year: targetYear,
        month: normalizedMonth,
        days: generateMonthView(targetYear, normalizedMonth, cycleStartDate),
      })
    }

    const firstDay = newMonths[0].days[0]?.date
    const lastDay = newMonths[newMonths.length - 1].days[newMonths[newMonths.length - 1].days.length - 1]?.date

    if (firstDay && lastDay) {
      const data = await getCalendarDataForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay))

      const newReplacementMap = { ...replacementMap }
      if (data.replacements) {
        data.replacements.forEach((repl: any) => {
          const dateOnly = formatLocalDate(repl.shift_date)
          const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
          if (!newReplacementMap[key]) {
            newReplacementMap[key] = []
          }
          newReplacementMap[key].push(repl)
        })
      }
      setReplacementMap(newReplacementMap)

      const newExchangeMap = { ...exchangeMap }
      if (data.exchanges) {
        data.exchanges.forEach((exchange: any) => {
          const requesterDateOnly = formatLocalDate(exchange.requester_shift_date)
          const requesterKey = `${requesterDateOnly}_${exchange.requester_shift_type}_${exchange.requester_team_id}`
          if (!newExchangeMap[requesterKey]) {
            newExchangeMap[requesterKey] = []
          }
          newExchangeMap[requesterKey].push({ ...exchange, type: "requester" })

          const targetDateOnly = formatLocalDate(exchange.target_shift_date)
          const targetKey = `${targetDateOnly}_${exchange.target_shift_type}_${exchange.target_team_id}`
          if (!newExchangeMap[targetKey]) {
            newExchangeMap[targetKey] = []
          }
          newExchangeMap[targetKey].push({ ...exchange, type: "target" })
        })
      }
      setExchangeMap(newExchangeMap)

      const newLeaveMap = { ...leaveMap }
      if (data.leaves) {
        data.leaves.forEach((leave: any) => {
          const startDate = new Date(leave.start_date)
          const endDate = new Date(leave.end_date)
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatDateForDB(d)
            const key = `${dateStr}_${leave.user_id}`
            if (!newLeaveMap[key]) {
              newLeaveMap[key] = []
            }
            newLeaveMap[key].push(leave)
          }
        })
        setLeaves([...leaves, ...data.leaves])
      }
      setLeaveMap(newLeaveMap)

      const newNoteMap = { ...noteMap }
      if (data.shiftNotes) {
        data.shiftNotes.forEach((note: any) => {
          const dateOnly = formatLocalDate(note.shift_date)
          const key = `${note.shift_id}_${dateOnly}`
          newNoteMap[key] = true
        })
      }
      setNoteMap(newNoteMap)

      const newDirectAssignmentMap = { ...directAssignmentMap }
      if (data.directAssignments) {
        data.directAssignments.forEach((assignment: any) => {
          const dateOnly = formatLocalDate(assignment.shift_date)
          const key = `${dateOnly}_${assignment.shift_type}_${assignment.team_id}`
          if (!newDirectAssignmentMap[key]) {
            newDirectAssignmentMap[key] = []
          }
          newDirectAssignmentMap[key].push(assignment)
        })
      }
      setDirectAssignmentMap(newDirectAssignmentMap)

      const newActingDesignationMap: Record<string, { isActingLieutenant: boolean; isActingCaptain: boolean }> = {}
      if (data.actingDesignations) {
        console.log("[v0] handleShiftUpdated - processing", data.actingDesignations.length, "acting designations")
        data.actingDesignations.forEach((ad: any) => {
          const dateStr = ad.shift_date ? formatLocalDate(ad.shift_date) : null
          if (dateStr) {
            let key: string
            if (ad.is_direct_assignment && ad.replaced_user_id) {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_direct_${ad.replaced_user_id}`
            } else {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_original`
            }
            console.log("[v0] actingDesignationMap adding key:", key, "with values:", {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
              user_id: ad.user_id,
              is_direct_assignment: ad.is_direct_assignment,
              replaced_user_id: ad.replaced_user_id,
            })
            newActingDesignationMap[key] = {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
            }
          }
        })
      }
      console.log("[v0] handleShiftUpdated - new actingDesignationMap keys:", Object.keys(newActingDesignationMap))
      console.log(
        "[v0] handleShiftUpdated - new actingDesignationMap FULL:",
        JSON.stringify(newActingDesignationMap, null, 2),
      )
      setActingDesignationMap({ ...newActingDesignationMap })

      const newExtraFirefighterMap = { ...extraFirefighterMap }
      if (data.extraFirefighters) {
        data.extraFirefighters.forEach((firefighter: any) => {
          const dateOnly = formatLocalDate(firefighter.shift_date)
          const key = `${dateOnly}_${firefighter.shift_type}_${firefighter.team_id}`
          if (!newExtraFirefighterMap[key]) {
            newExtraFirefighterMap[key] = []
          }
          newExtraFirefighterMap[key].push(firefighter)
        })
      }
      setExtraFirefighterMap(newExtraFirefighterMap)
    }

    setMonths([...months, ...newMonths])
    setLoading(false)
  }

  const handleReplacementCreated = useCallback(async () => {
    console.log("[v0] CalendarView - replacement created, reloading data")

    // Get the first month date range
    const firstMonth = months[0]
    if (!firstMonth || !firstMonth.days.length) return

    const firstDay = firstMonth.days[0].date
    const lastMonth = months[months.length - 1]
    const lastDay = lastMonth.days[lastMonth.days.length - 1].date

    const data = await getCalendarDataForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay))

    // Build new replacement map
    const newReplacementMap: Record<string, any[]> = {}
    data.replacements.forEach((repl: any) => {
      const dateOnly = formatLocalDate(repl.shift_date)
      const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
      if (!newReplacementMap[key]) {
        newReplacementMap[key] = []
      }
      newReplacementMap[key].push(repl)
    })
    setReplacementMap(newReplacementMap)

    const newExtraFirefighterMap: Record<string, any[]> = {}
    if (data.extraFirefighters && data.extraFirefighters.length > 0) {
      data.extraFirefighters.forEach((extra: any) => {
        const dateOnly = formatLocalDate(extra.shift_date)
        const key = `${dateOnly}_${extra.shift_type}_${extra.team_id}`
        if (!newExtraFirefighterMap[key]) {
          newExtraFirefighterMap[key] = []
        }
        newExtraFirefighterMap[key].push(extra)
      })
    }
    setExtraFirefighterMap(newExtraFirefighterMap)

    console.log("[v0] CalendarView - replacement map and extra firefighter map updated")
  }, [months])

  const handleShiftUpdated = useCallback(
    async (updatedShift: any) => {
      console.log("[v0] CalendarView - shift updated, refreshing calendar data")

      const firstMonth = months[0]
      if (!firstMonth || !firstMonth.days.length) return

      const firstDay = firstMonth.days[0].date
      const lastMonth = months[months.length - 1]
      const lastDay = lastMonth.days[lastMonth.days.length - 1].date

      console.log(
        "[v0] handleShiftUpdated - fetching data from",
        formatDateForDB(firstDay),
        "to",
        formatDateForDB(lastDay),
      )

      const data = await getCalendarDataForDateRange(formatDateForDB(firstDay), formatDateForDB(lastDay))
      const directAssignmentsData = data.directAssignments

      console.log("[v0] handleShiftUpdated - received data:", data)
      console.log("[v0] handleShiftUpdated - received directAssignments:", directAssignmentsData?.length || 0)
      console.log("[v0] handleShiftUpdated - received replacements:", data.replacements?.length || 0)
      console.log("[v0] handleShiftUpdated - received actingDesignations COUNT:", data.actingDesignations?.length || 0)
      console.log(
        "[v0] handleShiftUpdated - received actingDesignations FULL DATA:",
        JSON.stringify(data.actingDesignations, null, 2),
      )
      console.log("[v0] handleShiftUpdated - received extraFirefighters:", data.extraFirefighters?.length || 0)

      const newDirectAssignmentMap: Record<string, any[]> = {}
      if (directAssignmentsData) {
        directAssignmentsData.forEach((assignment: any) => {
          const dateOnly = formatLocalDate(assignment.shift_date)
          const key = `${dateOnly}_${assignment.shift_type}_${assignment.team_id}`
          if (!newDirectAssignmentMap[key]) {
            newDirectAssignmentMap[key] = []
          }
          newDirectAssignmentMap[key].push(assignment)
        })
      }
      console.log("[v0] handleShiftUpdated - new directAssignmentMap keys:", Object.keys(newDirectAssignmentMap))
      setDirectAssignmentMap(newDirectAssignmentMap)

      // Also update replacement map since other actions might have happened
      const newReplacementMap: Record<string, any[]> = {}
      data.replacements.forEach((repl: any) => {
        const dateOnly = formatLocalDate(repl.shift_date)
        const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
        if (!newReplacementMap[key]) {
          newReplacementMap[key] = []
        }
        newReplacementMap[key].push(repl)
      })
      setReplacementMap(newReplacementMap)

      const newActingDesignationMap: Record<string, { isActingLieutenant: boolean; isActingCaptain: boolean }> = {}
      if (data.actingDesignations) {
        console.log("[v0] handleShiftUpdated - processing", data.actingDesignations.length, "acting designations")
        data.actingDesignations.forEach((ad: any) => {
          const dateStr = ad.shift_date ? formatLocalDate(ad.shift_date) : null
          if (dateStr) {
            let key: string
            if (ad.is_direct_assignment && ad.replaced_user_id) {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_direct_${ad.replaced_user_id}`
            } else {
              key = `${dateStr}_${ad.shift_type}_${ad.team_id}_${ad.user_id}_original`
            }
            console.log("[v0] actingDesignationMap adding key:", key, "with values:", {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
              user_id: ad.user_id,
              is_direct_assignment: ad.is_direct_assignment,
              replaced_user_id: ad.replaced_user_id,
            })
            newActingDesignationMap[key] = {
              isActingLieutenant: ad.is_acting_lieutenant,
              isActingCaptain: ad.is_acting_captain,
            }
          }
        })
      }
      console.log("[v0] handleShiftUpdated - new actingDesignationMap keys:", Object.keys(newActingDesignationMap))
      console.log(
        "[v0] handleShiftUpdated - new actingDesignationMap FULL:",
        JSON.stringify(newActingDesignationMap, null, 2),
      )
      setActingDesignationMap({ ...newActingDesignationMap })

      const newExtraFirefighterMap: Record<string, any[]> = {}
      if (data.extraFirefighters) {
        data.extraFirefighters.forEach((firefighter: any) => {
          const dateOnly = formatLocalDate(firefighter.shift_date)
          const key = `${dateOnly}_${firefighter.shift_type}_${firefighter.team_id}`
          if (!newExtraFirefighterMap[key]) {
            newExtraFirefighterMap[key] = []
          }
          newExtraFirefighterMap[key].push(firefighter)
        })
      }
      console.log("[v0] handleShiftUpdated - new extraFirefighterMap keys:", Object.keys(newExtraFirefighterMap))
      setExtraFirefighterMap(newExtraFirefighterMap)

      console.log(
        "[v0] CalendarView - direct assignment map, replacement map, acting designation map, and extra firefighters map updated",
      )
    },
    [months],
  )

  const handleNoteChange = async () => {
    try {
      console.log("[v0] CalendarView - note changed, reloading notes")

      // Reload notes from the server using the server action
      const startDate = formatDateForDB(months[0].days[0].date)
      const endDate = formatDateForDB(months[months.length - 1].days[months[months.length - 1].days.length - 1].date)

      const shiftNotes = await getShiftNotesForDateRange(startDate, endDate)

      // Update the noteMap with the new notes
      const newNoteMap: Record<string, boolean> = {}
      shiftNotes.forEach((note: any) => {
        const dateOnly = formatLocalDate(note.shift_date)
        const key = `${note.shift_id}_${dateOnly}`
        newNoteMap[key] = true
      })

      setNoteMap(newNoteMap)
      console.log("[v0] CalendarView - notes reloaded, noteMap updated")
    } catch (error) {
      console.error("[v0] Error reloading notes:", error)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center">
        <Button onClick={loadPreviousMonths} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
          <ChevronUp className="h-4 w-4" />
          {loading ? "Chargement..." : "Charger les mois précédents"}
        </Button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 md:gap-3 mb-4">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
            <div key={day} className="text-center text-xs md:text-sm font-semibold text-muted-foreground py-1 md:py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid gap-1 md:gap-3 grid-cols-7">
          {months.flatMap(({ year, month, days }, monthIndex) => {
            const cells = []

            if (monthIndex === 0 && days.length > 0) {
              const firstDayOfWeek = days[0].dayOfWeek
              for (let i = 0; i < firstDayOfWeek; i++) {
                cells.push(<div key={`empty-${year}-${month}-${i}`} />)
              }
            }

            // Add actual day cells
            days.forEach((day, index) => {
              const shifts = shiftsByCycleDay[day.cycleDay] || []
              const dateStr = formatLocalDate(day.date)

              const dayReplacements = shifts.map((shift: any) => {
                const key = `${dateStr}_${shift.shift_type}_${shift.team_id}`
                return replacementMap[key] || []
              })

              const dayExchanges = shifts.map((shift: any) => {
                const key = `${dateStr}_${shift.shift_type}_${shift.team_id}`
                return exchangeMap[key] || []
              })

              const dayDirectAssignments = shifts.map((shift: any) => {
                const key = `${dateStr}_${shift.shift_type}_${shift.team_id}`
                return directAssignmentMap[key] || []
              })

              const dayExtraFirefighters = shifts.map((shift: any) => {
                const key = `${dateStr}_${shift.shift_type}_${shift.team_id}`
                return extraFirefighterMap[key] || []
              })

              const actingDesignations = actingDesignationMap

              const shiftsWithNotes = shifts.map((shift: any) => {
                const noteKey = `${shift.id}_${dateStr}`
                return {
                  ...shift,
                  has_note: noteMap[noteKey] || false,
                }
              })

              const showMonthBadge = day.isFirstDayOfMonth

              cells.push(
                <div key={`${year}-${month}-${index}`} className="relative">
                  {showMonthBadge && (
                    <div className="absolute top-5 left-0 right-0 justify-center z-10 pointer-events-none hidden md:flex">
                      <span className="text-sm font-bold text-orange-600">
                        {getMonthName(month)} {year}
                      </span>
                    </div>
                  )}
                  <CalendarCell
                    day={day}
                    shifts={shiftsWithNotes}
                    replacements={dayReplacements}
                    exchanges={dayExchanges}
                    leaves={leaves}
                    leaveMap={leaveMap}
                    directAssignments={dayDirectAssignments}
                    actingDesignationMap={actingDesignations}
                    extraFirefighters={dayExtraFirefighters}
                    dateStr={dateStr}
                    isAdmin={isAdmin}
                    onReplacementCreated={handleReplacementCreated}
                    onShiftUpdated={handleShiftUpdated}
                    onNoteChange={handleNoteChange}
                  />
                </div>,
              )
            })

            return cells
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={loadNextMonths} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
          {loading ? "Chargement..." : "Charger les mois suivants"}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
