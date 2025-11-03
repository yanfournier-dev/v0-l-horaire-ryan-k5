"use client"

import { useEffect } from "react"
import { getCurrentLocalDate } from "@/lib/date-utils"

export function ScrollToToday() {
  useEffect(() => {
    const hasVisited = sessionStorage.getItem("calendar-visited")

    if (!hasVisited) {
      // First visit - scroll to today
      sessionStorage.setItem("calendar-visited", "true")

      let attempts = 0
      const maxAttempts = 10
      const attemptDelay = 50

      const tryScroll = () => {
        attempts++
        const todayStr = getCurrentLocalDate()
        const todayElement = document.getElementById(`day-${todayStr}`)

        if (todayElement) {
          todayElement.scrollIntoView({
            behavior: "instant",
            block: "center",
          })
          return true
        } else if (attempts < maxAttempts) {
          setTimeout(tryScroll, attemptDelay)
          return false
        }
        return false
      }

      const timer = setTimeout(tryScroll, 0)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [])

  return null
}
