"use client"

import { useEffect } from "react"
import { getCurrentLocalDate } from "@/lib/date-utils"

export function ScrollToToday() {
  useEffect(() => {
    console.log("[v0] ScrollToToday: Component mounted, starting scroll")

    let attempts = 0
    const maxAttempts = 10
    const attemptDelay = 50

    const tryScroll = () => {
      attempts++
      const todayStr = getCurrentLocalDate()
      console.log(`[v0] ScrollToToday: Attempt ${attempts}/${maxAttempts}, looking for element: day-${todayStr}`)

      const todayElement = document.getElementById(`day-${todayStr}`)
      console.log(`[v0] ScrollToToday: Element found: ${!!todayElement}`)

      if (todayElement) {
        console.log("[v0] ScrollToToday: Scrolling to today")
        todayElement.scrollIntoView({
          behavior: "instant",
          block: "center",
        })
        console.log("[v0] ScrollToToday: Scroll complete")
        return true
      } else if (attempts < maxAttempts) {
        console.log(`[v0] ScrollToToday: Element not found, will retry in ${attemptDelay}ms`)
        setTimeout(tryScroll, attemptDelay)
        return false
      } else {
        console.log("[v0] ScrollToToday: Max attempts reached, element not found in DOM")
        return false
      }
    }

    const timer = setTimeout(tryScroll, 0)

    return () => {
      console.log("[v0] ScrollToToday: Component unmounting, clearing timer")
      clearTimeout(timer)
    }
  }, [])

  return null
}
