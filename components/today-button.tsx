"use client"

import { Button } from "@/components/ui/button"

export function TodayButton() {
  const scrollToToday = () => {
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]
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
