"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export function ScrollToReplacement() {
  const searchParams = useSearchParams()

  useEffect(() => {
    console.log("[v0] ScrollToReplacement effect triggered")

    const scrollTarget = sessionStorage.getItem("scrollToReplacement")
    console.log("[v0] scrollTarget from sessionStorage:", scrollTarget)

    if (scrollTarget) {
      console.log("[v0] Found scroll target, will attempt to scroll")

      const attemptScroll = (attempt = 1) => {
        console.log(`[v0] Scroll attempt ${attempt}, looking for element:`, scrollTarget)
        const element = document.getElementById(scrollTarget)
        console.log(`[v0] Element found on attempt ${attempt}:`, element)

        if (element) {
          console.log("[v0] Scrolling to element")
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          const offsetPosition = elementPosition - 120 // Offset to show date header above

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          })
          // Add highlight effect
          element.classList.add("ring-2", "ring-primary", "ring-offset-2")
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2")
          }, 2000)
          // Clear sessionStorage after successful scroll
          sessionStorage.removeItem("scrollToReplacement")
          console.log("[v0] Cleared sessionStorage after successful scroll")
        } else if (attempt < 5) {
          // Try again with longer delay
          console.log(`[v0] Element not found, will retry in ${attempt * 200}ms`)
          setTimeout(() => attemptScroll(attempt + 1), attempt * 200)
        } else {
          console.log("[v0] Element not found after 5 attempts, giving up")
          sessionStorage.removeItem("scrollToReplacement")
        }
      }

      // Start first attempt after a short delay
      setTimeout(() => attemptScroll(), 100)
      return
    }

    // Check if there's a hash in the URL (for return from details page)
    const hash = window.location.hash
    console.log("[v0] Hash from URL:", hash)

    if (hash) {
      // Remove the # from the hash
      const elementId = hash.substring(1)
      // Wait a bit for the page to render
      setTimeout(() => {
        const element = document.getElementById(elementId)
        if (element) {
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          const offsetPosition = elementPosition - 120 // Offset to show date header above

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          })
          // Add highlight effect
          element.classList.add("ring-2", "ring-primary", "ring-offset-2")
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2")
          }, 2000)
        }
      }, 300)
    }
  }, [searchParams])

  return null
}
