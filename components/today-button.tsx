"use client"

import { Button } from "@/components/ui/button"
import { getCurrentLocalDate } from "@/lib/date-utils"

export function TodayButton() {
  const scrollToToday = () => {
    const todayStr = getCurrentLocalDate()
    const todayElement = document.getElementById(`day-${todayStr}`)

    if (todayElement) {
      todayElement.scrollIntoView({
        behavior: "instant",
        block: "center",
      })
    }
  }

  return (
    <Button variant="outline" className="px-4 bg-transparent" onClick={scrollToToday}>
      Aujourd'hui
    </Button>
  )
}
