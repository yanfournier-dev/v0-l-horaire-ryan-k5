"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DeadlineTimerProps {
  deadline: string | null
  className?: string
}

export function DeadlineTimer({ deadline, className }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!deadline) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const deadlineTime = new Date(deadline).getTime()
      const diff = deadlineTime - now

      console.log("[v0] DeadlineTimer - deadline string:", deadline)
      console.log("[v0] DeadlineTimer - now timestamp:", now, "date:", new Date(now).toISOString())
      console.log(
        "[v0] DeadlineTimer - deadline timestamp:",
        deadlineTime,
        "date:",
        new Date(deadlineTime).toISOString(),
      )
      console.log("[v0] DeadlineTimer - diff (ms):", diff, "minutes:", diff / (1000 * 60))

      if (diff <= 0) {
        setIsExpired(true)
        setTimeLeft("Expiré")
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
  }, [deadline])

  if (!deadline) return null

  return (
    <Badge variant={isExpired ? "destructive" : "secondary"} className={className}>
      <Clock className="mr-1 h-3 w-3" />
      {isExpired ? "Fermé" : `Expire dans ${timeLeft}`}
    </Badge>
  )
}
