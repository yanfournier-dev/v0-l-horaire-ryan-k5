"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { calculateEndOfShiftDeadline } from "@/lib/date-utils"

interface DeadlineSelectProps {
  value: number | null | Date | null
  onValueChange: (value: number | null | Date | null) => void
  shiftDate?: Date
  shiftEndTime?: string
  partialEndTime?: string
  isPartial?: boolean
  shift?: any // Assuming shift is an object that contains start_time
}

export function DeadlineSelect({
  value,
  onValueChange,
  shiftDate,
  shiftEndTime,
  partialEndTime,
  isPartial,
  shift,
}: DeadlineSelectProps) {
  const [deadlineType, setDeadlineType] = useState<"none" | "preset" | "first-come" | "summer-vacation">(
    value === null
      ? "none"
      : value instanceof Date
        ? "none" // If existing manual deadline, show as "none" (can't create new ones)
        : value === -1
          ? "first-come"
          : value === -2
            ? "summer-vacation"
            : "preset",
  )

  const stringValue =
    value === null
      ? "none"
      : value === -1
        ? "first-come"
        : value === -2
          ? "summer-vacation"
          : value instanceof Date
            ? "none" // Existing manual deadlines display as "none"
            : value.toString()

  const handleTypeChange = (newType: string) => {
    setDeadlineType(newType as "none" | "preset" | "first-come" | "summer-vacation")

    if (newType === "none") {
      onValueChange(null)
    } else if (newType === "first-come") {
      onValueChange(-1)
    } else if (newType === "summer-vacation") {
      onValueChange(-2)
    }
  }

  const handlePresetChange = (newValue: string) => {
    if (newValue === "none") {
      onValueChange(null)
    } else if (newValue === "first-come") {
      setDeadlineType("first-come")
      onValueChange(-1)
    } else if (newValue === "summer-vacation") {
      setDeadlineType("summer-vacation")
      onValueChange(-2)
    } else {
      onValueChange(Number.parseInt(newValue, 10))
    }
  }

  const getFirstComeDisplayText = () => {
    if (!shiftDate || !shiftEndTime) return "Sans délai"

    const endTime = isPartial && partialEndTime ? partialEndTime : shiftEndTime
    const startTime = shift?.start_time || "07:00"
    const actualDeadline = calculateEndOfShiftDeadline(shiftDate, endTime, startTime)

    const year = actualDeadline.getFullYear()
    const month = actualDeadline.getMonth()
    const day = actualDeadline.getDate()
    const hours = actualDeadline.getHours()
    const minutes = actualDeadline.getMinutes()

    const monthNames = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ]
    const dateStr = `${day} ${monthNames[month]} ${year}`
    const timeStr = `${String(hours).padStart(2, "0")} h ${String(minutes).padStart(2, "0")}`

    return `Sans délai (${dateStr} à ${timeStr})`
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="deadline">Délai pour postuler</Label>
      <Select
        value={deadlineType === "first-come" || deadlineType === "summer-vacation" ? deadlineType : stringValue}
        onValueChange={
          deadlineType === "first-come" || deadlineType === "summer-vacation" ? handleTypeChange : handlePresetChange
        }
      >
        <SelectTrigger id="deadline">
          <SelectValue placeholder="Lundi 17h" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Lundi 17h</SelectItem>
          <SelectItem value="900">15 minutes</SelectItem>
          <SelectItem value="86400">24 heures</SelectItem>
          <SelectItem value="first-come">{getFirstComeDisplayText()}</SelectItem>
          <SelectItem value="summer-vacation">Vacance estivale (16 mai minuit)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
