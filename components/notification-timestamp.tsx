"use client"

import { useEffect, useState } from "react"

export function NotificationTimestamp({ timestamp }: { timestamp: string }) {
  const [formattedDate, setFormattedDate] = useState<string>("")

  useEffect(() => {
    const date = new Date(timestamp)
    const correctedTimestamp = date.getTime() - 5 * 60 * 60 * 1000
    const correctedDate = new Date(correctedTimestamp)

    const dateStr = new Intl.DateTimeFormat("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Toronto",
    }).format(correctedDate)

    const timeStr = new Intl.DateTimeFormat("fr-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Toronto",
    }).format(correctedDate)

    const [year, month, day] = dateStr.split("-")
    // timeStr is like "20 h 07" in French locale
    const timeParts = timeStr.replace(" h ", ":").split(":")
    const hour = timeParts[0]
    const minute = timeParts[1]

    const formatted = `${year}-${month}-${day} à ${hour}h${minute}`

    setFormattedDate(formatted)
  }, [timestamp])

  if (!formattedDate) {
    return <span className="text-xs text-muted-foreground">...</span>
  }

  return <span className="text-xs text-muted-foreground">{formattedDate}</span>
}
