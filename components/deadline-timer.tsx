"use client"

import { useEffect, useState } from "react"
import { Clock, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { calculateAutoDeadline } from "@/lib/date-utils"

interface DeadlineTimerProps {
  deadline: string | null
  deadlineDuration: number | null
  shiftDate: string
  className?: string
}

export function DeadlineTimer({ deadline, deadlineDuration, shiftDate, className }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isExpired, setIsExpired] = useState(false)
  const [displayDeadline, setDisplayDeadline] = useState<string>("")

  useEffect(() => {
    if (deadlineDuration !== null && deadline) {
      const effectiveDeadline = new Date(deadline)

      const updateTimer = () => {
        const now = new Date().getTime()
        const deadlineTime = effectiveDeadline.getTime()
        const diff = deadlineTime - now

        if (diff <= 0) {
          setIsExpired(true)
          setTimeLeft("Fermé")
          return
        }

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m`)
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`)
        } else {
          setTimeLeft(`${seconds}s`)
        }
      }

      updateTimer()
      const interval = setInterval(updateTimer, 1000)

      return () => clearInterval(interval)
    }

    let effectiveDeadline: Date

    if (deadline) {
      effectiveDeadline = new Date(deadline)
    } else {
      effectiveDeadline = calculateAutoDeadline(shiftDate)
    }

    const date = effectiveDeadline
    const day = date.getDate()
    const monthNames = [
      "janv.",
      "févr.",
      "mars",
      "avr.",
      "mai",
      "juin",
      "juil.",
      "août",
      "sept.",
      "oct.",
      "nov.",
      "déc.",
    ]
    const month = monthNames[date.getMonth()]
    const hour = date.getHours()
    const minute = date.getMinutes()
    const timeStr = minute > 0 ? `${hour}h${minute.toString().padStart(2, "0")}` : `${hour}h`
    setDisplayDeadline(`${day} ${month}. ${timeStr}`)

    const checkExpired = () => {
      const now = new Date().getTime()
      const deadlineTime = effectiveDeadline.getTime()
      setIsExpired(deadlineTime <= now)
    }

    checkExpired()
    const interval = setInterval(checkExpired, 60000)

    return () => clearInterval(interval)
  }, [deadline, deadlineDuration, shiftDate])

  if (deadlineDuration === null) {
    // Automatic or manual deadline
    return (
      <Badge
        variant="secondary"
        className={`${className} text-xs px-2 py-0.5 h-5 leading-none gap-1 ${
          isExpired ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : ""
        }`}
      >
        <Calendar className="h-3 w-3" />
        {isExpired ? "Fermé" : displayDeadline}
      </Badge>
    )
  }

  if (!deadline) return null

  // Countdown timer
  return (
    <Badge
      variant={isExpired ? "destructive" : "default"}
      className={`${className} text-xs px-2 py-0.5 h-5 leading-none gap-1 ${
        isExpired
          ? "bg-red-600 hover:bg-red-700 text-white"
          : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200"
      }`}
    >
      <Clock className="h-3 w-3" />
      {isExpired ? "Fermé" : timeLeft}
    </Badge>
  )
}
