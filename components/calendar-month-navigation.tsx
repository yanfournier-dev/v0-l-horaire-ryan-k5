"use client"

import { Button } from "@/components/ui/button"
import { getCurrentLocalDate } from "@/lib/date-utils"

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

export function CalendarMonthNavigation() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  const scrollToToday = () => {
    const skipFlag = sessionStorage.getItem("skip-scroll-to-today")

    if (skipFlag) {
      console.log("[v0] TodayButton - skipping due to skip flag")
      sessionStorage.removeItem("skip-scroll-to-today")
      return
    }

    const todayStr = getCurrentLocalDate()
    const todayElement = document.getElementById(`day-${todayStr}`)

    if (todayElement) {
      const elementPosition = todayElement.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - 100

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })

      sessionStorage.setItem("calendar-scroll-position", offsetPosition.toString())
    }
  }

  const scrollToMonth = (monthOffset: number) => {
    const targetMonth = currentMonth + monthOffset
    const targetYear = currentYear + Math.floor(targetMonth / 12)
    const normalizedMonth = ((targetMonth % 12) + 12) % 12

    const targetDate = new Date(targetYear, normalizedMonth, 1)
    const dateStr = targetDate.toISOString().split("T")[0]
    const monthElement = document.getElementById(`day-${dateStr}`)

    if (monthElement) {
      const elementPosition = monthElement.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - 100

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
    }
  }

  // Generate buttons for next 11 months
  const monthButtons = []
  for (let i = 1; i <= 11; i++) {
    const targetMonth = currentMonth + i
    const targetYear = currentYear + Math.floor(targetMonth / 12)
    const normalizedMonth = targetMonth % 12
    const monthName = MONTH_NAMES[normalizedMonth]
    const displayYear = targetYear !== currentYear ? ` ${targetYear}` : ""

    monthButtons.push(
      <Button
        key={i}
        variant="outline"
        className="px-1.5 py-1 bg-gray-100/30 hover:bg-gray-200/40 border-gray-300/50 text-gray-600 hover:text-gray-800 shadow-sm transition-all duration-200 text-[10px] font-normal whitespace-nowrap"
        onClick={() => scrollToMonth(i)}
      >
        {monthName}
        {displayYear}
      </Button>,
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="px-1.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-700 hover:text-red-800 shadow-sm hover:shadow-md transition-all duration-200 text-[10px] font-semibold whitespace-nowrap"
        onClick={scrollToToday}
      >
        Aujourd'hui
      </Button>

      {monthButtons}
    </div>
  )
}
