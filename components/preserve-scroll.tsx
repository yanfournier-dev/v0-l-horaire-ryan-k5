"use client"

import { useEffect } from "react"

export function PreserveScroll() {
  useEffect(() => {
    console.log("[v0] PreserveScroll mounted")

    const saveScroll = () => {
      const scroll = window.scrollY
      if (scroll > 0) {
        sessionStorage.setItem("calendar-scroll-position", scroll.toString())
      }
    }

    // Save every 500ms for better performance
    const interval = setInterval(saveScroll, 500)

    // Save on scroll events
    window.addEventListener("scroll", saveScroll, { passive: true })

    const observer = new MutationObserver(() => {
      const currentScroll = window.scrollY
      const savedScrollStr = sessionStorage.getItem("calendar-scroll-position")
      const savedScroll = savedScrollStr ? Number.parseFloat(savedScrollStr) : 0

      console.log("[v0] PreserveScroll - DOM mutation detected:", {
        currentScroll,
        savedScroll,
        shouldRestore: savedScroll > 100 && currentScroll < 50,
      })

      if (savedScroll > 100 && currentScroll < 50) {
        console.log("[v0] PreserveScroll - restoring scroll to:", savedScroll)
        window.scrollTo(0, savedScroll)

        // Verify restoration
        setTimeout(() => {
          console.log("[v0] PreserveScroll - scroll after restore:", window.scrollY)
        }, 50)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      console.log("[v0] PreserveScroll unmounting")
      clearInterval(interval)
      window.removeEventListener("scroll", saveScroll)
      observer.disconnect()
    }
  }, [])

  return null
}
