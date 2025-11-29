"use client"

import { Button } from "@/components/ui/button"
import { getCurrentLocalDate } from "@/lib/date-utils"

export function TodayButton() {
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

      console.log("[v0] TodayButton - scroll calculation:", {
        elementPosition,
        offsetPosition,
        currentScroll: window.scrollY,
      })

      window.scrollTo({
        top: offsetPosition,
        behavior: "instant",
      })

      sessionStorage.setItem("calendar-scroll-position", offsetPosition.toString())
    }
  }

  return (
    <Button
      variant="default"
      className="px-1.5 py-1 bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl transition-all duration-200 text-[10px] font-semibold whitespace-nowrap"
      onClick={scrollToToday}
    >
      Aujourd'hui
    </Button>
  )
}
