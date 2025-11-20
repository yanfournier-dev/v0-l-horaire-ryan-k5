"use client"

import { useState, useEffect, useRef } from "react"
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
  isAdmin: boolean
  cycleStartDate: Date
  currentYear: number
  currentMonth: number
}

export function CalendarView({
  initialMonths,
  shiftsByCycleDay,
  replacementMap: initialReplacementMap,
  exchangeMap: initialExchangeMap,
  leaves: initialLeaves,
  leaveMap: initialLeaveMap,
  noteMap: initialNoteMap,
  isAdmin,
  cycleStartDate,
  currentYear,
  currentMonth,
}: CalendarViewProps) {
  const [months, setMonths] = useState(initialMonths)
  const [replacementMap, setReplacementMap] = useState(initialReplacementMap)
  const [exchangeMap, setExchangeMap] = useState(initialExchangeMap)
  const [leaves, setLeaves] = useState(initialLeaves)
  const [leaveMap, setLeaveMap] = useState(initialLeaveMap)
  const [noteMap, setNoteMap] = useState(initialNoteMap)
  const [loading, setLoading] = useState(false)
  const scrollAnchorRef = useRef<string | null>(null)

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

  useEffect(() => {
    let dataPolling: NodeJS.Timeout | null = null
    let isReloading = false

    const checkAndReload = async () => {
      if (typeof window === "undefined") return

      if (isReloading) return

      const timestamp = sessionStorage.getItem("replacement-created-timestamp")
      if (!timestamp) return

      const createdTime = Number.parseInt(timestamp, 10)
      const now = Date.now()
      const elapsed = now - createdTime

      // Only reload if timestamp is less than 5 seconds old
      if (elapsed < 5000) {
        isReloading = true
        console.log("[v0] CalendarView - reloading data after replacement creation")

        // Remove the flag immediately
        sessionStorage.removeItem("replacement-created-timestamp")

        // Reload data for the first month only
        const firstMonth = months[0]
        if (firstMonth && firstMonth.days.length > 0) {
          const firstDay = firstMonth.days[0]?.date
          const lastDay = firstMonth.days[firstMonth.days.length - 1]?.date

          if (firstDay && lastDay) {
            try {
              const response = await fetch(
                `/api/calendar-data?startDate=${formatDateForDB(firstDay)}&endDate=${formatDateForDB(lastDay)}`,
              )

              if (!response.ok) {
                throw new Error("Failed to fetch calendar data")
              }

              const data = await response.json()

              const newReplacementMap = { ...replacementMap }
              // Clear old entries for this month
              Object.keys(newReplacementMap).forEach((key) => {
                const keyDate = key.split("_")[0]
                if (keyDate >= formatLocalDate(firstDay) && keyDate <= formatLocalDate(lastDay)) {
                  delete newReplacementMap[key]
                }
              })
              // Add new replacements
              data.replacements.forEach((repl: any) => {
                const dateOnly = formatLocalDate(repl.shift_date)
                const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
                if (!newReplacementMap[key]) {
                  newReplacementMap[key] = []
                }
                newReplacementMap[key].push(repl)
              })
              setReplacementMap(newReplacementMap)

              console.log("[v0] CalendarView - data reload complete, new replacements:", data.replacements.length)
            } catch (error) {
              console.error("[v0] CalendarView - error reloading data:", error)
            }
          }
        }

        isReloading = false
      } else if (elapsed >= 5000) {
        // Clean up old flag
        sessionStorage.removeItem("replacement-created-timestamp")
      }
    }

    // Check immediately
    checkAndReload()

    // Poll every 500ms
    dataPolling = setInterval(() => {
      checkAndReload()
    }, 500)

    return () => {
      if (dataPolling) clearInterval(dataPolling)
    }
  }, [months]) // Removed replacementMap from dependencies to prevent infinite loop

  const loadPreviousMonths = async () => {
    setLoading(true)
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
      data.replacements.forEach((repl: any) => {
        const dateOnly = formatLocalDate(repl.shift_date)
        const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
        if (!newReplacementMap[key]) {
          newReplacementMap[key] = []
        }
        newReplacementMap[key].push(repl)
      })
      setReplacementMap(newReplacementMap)

      const newExchangeMap = { ...exchangeMap }
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
      setExchangeMap(newExchangeMap)

      const newLeaveMap = { ...leaveMap }
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
      setLeaveMap(newLeaveMap)
      setLeaves([...leaves, ...data.leaves])

      const newNoteMap = { ...noteMap }
      data.shiftNotes.forEach((note: any) => {
        const dateOnly = formatLocalDate(note.shift_date)
        const key = `${note.shift_id}_${dateOnly}`
        newNoteMap[key] = true
      })
      setNoteMap(newNoteMap)
    }

    setMonths([...newMonths, ...months])
    setLoading(false)

    setTimeout(() => {
      if (scrollAnchorRef.current) {
        const anchorElement = document.getElementById(scrollAnchorRef.current)
        if (anchorElement) {
          anchorElement.scrollIntoView({
            behavior: "instant",
            block: "start",
          })
        }
        scrollAnchorRef.current = null
      }
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
      data.replacements.forEach((repl: any) => {
        const dateOnly = formatLocalDate(repl.shift_date)
        const key = `${dateOnly}_${repl.shift_type}_${repl.team_id}`
        if (!newReplacementMap[key]) {
          newReplacementMap[key] = []
        }
        newReplacementMap[key].push(repl)
      })
      setReplacementMap(newReplacementMap)

      const newExchangeMap = { ...exchangeMap }
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
      setExchangeMap(newExchangeMap)

      const newLeaveMap = { ...leaveMap }
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
      setLeaveMap(newLeaveMap)
      setLeaves([...leaves, ...data.leaves])

      const newNoteMap = { ...noteMap }
      data.shiftNotes.forEach((note: any) => {
        const dateOnly = formatLocalDate(note.shift_date)
        const key = `${note.shift_id}_${dateOnly}`
        newNoteMap[key] = true
      })
      setNoteMap(newNoteMap)
    }

    setMonths([...months, ...newMonths])
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center">
        <Button onClick={loadPreviousMonths} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
          <ChevronUp className="h-4 w-4" />
          {loading ? "Chargement..." : "Charger les mois précédents"}
        </Button>
      </div>

      {months.map(({ year, month, days }) => {
        const isCurrentMonth = year === currentYear && month === currentMonth

        return (
          <div key={`${year}-${month}`} id={`month-${year}-${month}`} className="flex flex-col gap-4">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground">
              {getMonthName(month)} {year}
              {isCurrentMonth && <span className="ml-2 text-sm font-normal text-muted-foreground">(Mois actuel)</span>}
            </h2>

            <div className="grid grid-cols-7 gap-1 md:gap-3">
              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs md:text-sm font-semibold text-muted-foreground py-1 md:py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid gap-1 md:gap-3 grid-cols-7">
              {days.map((day, index) => {
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

                const shiftsWithNotes = shifts.map((shift: any) => {
                  const noteKey = `${shift.id}_${dateStr}`
                  return {
                    ...shift,
                    has_note: noteMap[noteKey] || false,
                  }
                })

                return (
                  <CalendarCell
                    key={index}
                    day={day}
                    shifts={shiftsWithNotes}
                    replacements={dayReplacements}
                    exchanges={dayExchanges}
                    leaves={leaves}
                    leaveMap={leaveMap}
                    dateStr={dateStr}
                    isAdmin={isAdmin}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex justify-center">
        <Button onClick={loadNextMonths} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
          {loading ? "Chargement..." : "Charger les mois suivants"}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
