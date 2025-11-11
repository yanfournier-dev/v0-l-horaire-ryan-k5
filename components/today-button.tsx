"use client"

import { Button } from "@/components/ui/button"
import { getCurrentLocalDate } from "@/lib/date-utils"

export function TodayButton() {
  const scrollToToday = () => {
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
    <Button variant="outline" className="px-4 bg-transparent" onClick={scrollToToday}>
      Aujourd'hui
    </Button>
  )
}
