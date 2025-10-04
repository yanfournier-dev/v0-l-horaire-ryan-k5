"use client"

import { useEffect } from "react"

export function ScrollToReplacement() {
  useEffect(() => {
    // Check if there's a hash in the URL
    const hash = window.location.hash
    if (hash) {
      // Remove the # from the hash
      const elementId = hash.substring(1)
      // Wait a bit for the page to render
      setTimeout(() => {
        const element = document.getElementById(elementId)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
          // Optional: Add a highlight effect
          element.classList.add("ring-2", "ring-primary", "ring-offset-2")
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2")
          }, 2000)
        }
      }, 100)
    }
  }, [])

  return null
}
