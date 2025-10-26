"use client"

import { useState, useEffect, useRef } from "react"
import { CalendarCell } from "@/components/calendar-cell"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown } from "lucide-react"
import { generateMonthView, getMonthName } from "@/lib/calendar"
import { getCurrentLocalDate, formatLocalDate } from "@/lib/date-utils"

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
  replacementMap,
  exchangeMap,
  leaves,
  leaveMap,
  noteMap, // Destructure noteMap
  isAdmin,
  cycleStartDate,
  currentYear,
  currentMonth,
}: CalendarViewProps) {
  const [months, setMonths] = useState(initialMonths)
  const [hasScrolled, setHasScrolled] = useState(false)
  const scrollAnchorRef = useRef<string | null>(null)

  const todayStr = getCurrentLocalDate()

  useEffect(() => {
    if (!hasScrolled) {
      setTimeout(() => {
        const todayElement = document.getElementById(`day-${todayStr}`)
        if (todayElement) {
          todayElement.scrollIntoView({
            behavior: "instant",
            block: "center",
          })
        }
        setHasScrolled(true)
      }, 100)
    }
  }, [hasScrolled, todayStr])

  const loadPreviousMonths = () => {
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

    setMonths([...newMonths, ...months])

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

  const loadNextMonths = () => {
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

    setMonths([...months, ...newMonths])
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center">
        <Button onClick={loadPreviousMonths} variant="outline" className="gap-2 bg-transparent">
          <ChevronUp className="h-4 w-4" />
          Charger les mois précédents
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
        <Button onClick={loadNextMonths} variant="outline" className="gap-2 bg-transparent">
          Charger les mois suivants
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
