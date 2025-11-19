"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from 'next/navigation'
import { getCurrentLocalDate } from "@/lib/date-utils"

export function ScrollToTodayOnNav() {
  const searchParams = useSearchParams()
  const lastProcessedParamRef = useRef<string | null>(null)

  useEffect(() => {
    const skipFlag = sessionStorage.getItem('skip-scroll-to-today')
    if (skipFlag === 'true') {
      console.log("[v0] ScrollToTodayOnNav - skipping due to skip flag")
      sessionStorage.removeItem('skip-scroll-to-today')
      return
    }
    
    const shouldScroll = searchParams.get("scrollToToday")
    const currentParamValue = searchParams.toString()

    if (shouldScroll === "true" && lastProcessedParamRef.current !== currentParamValue) {
      lastProcessedParamRef.current = currentParamValue
      console.log("[v0] ScrollToTodayOnNav - triggering scroll to today")

      let attempts = 0
      const maxAttempts = 10

      const tryScroll = () => {
        attempts++
        const todayStr = getCurrentLocalDate()
        const todayElement = document.getElementById(`day-${todayStr}`)

        console.log(`[v0] ScrollToTodayOnNav - attempt ${attempts}, today element found:`, !!todayElement)

        if (todayElement) {
          const elementPosition = todayElement.getBoundingClientRect().top + window.scrollY
          const offsetPosition = elementPosition - 100 // Changed offset from 80px to 100px

          console.log("[v0] ScrollToTodayOnNav - scroll calculation:", {
            elementPosition,
            offsetPosition,
            currentScroll: window.scrollY,
          })

          window.scrollTo({
            top: offsetPosition,
            behavior: "instant",
          })

          sessionStorage.setItem("calendar-scroll-position", offsetPosition.toString())

          console.log("[v0] ScrollToTodayOnNav - scrolled to today successfully")

          setTimeout(() => {
            const url = new URL(window.location.href)
            url.searchParams.delete("scrollToToday")
            window.history.replaceState({}, "", url.toString())
            console.log("[v0] ScrollToTodayOnNav - removed param from URL without re-render")
          }, 100)
        } else if (attempts < maxAttempts) {
          setTimeout(tryScroll, 100)
        } else {
          console.log("[v0] ScrollToTodayOnNav - max attempts reached, element not found")
        }
      }

      setTimeout(tryScroll, 300)
    }
  }, [searchParams])

  return null
}
