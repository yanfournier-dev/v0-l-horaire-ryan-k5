"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar } from "lucide-react"

interface DeadlineSelectProps {
  value: number | null | Date | null
  onValueChange: (value: number | null | Date | null) => void
}

export function DeadlineSelect({ value, onValueChange }: DeadlineSelectProps) {
  const [deadlineType, setDeadlineType] = useState<"none" | "preset" | "manual">(
    value === null ? "none" : value instanceof Date ? "manual" : "preset",
  )
  const [manualDate, setManualDate] = useState<string>("")
  const [manualTime, setManualTime] = useState<string>("17:00")

  const stringValue = value === null ? "none" : value instanceof Date ? "manual" : value.toString()

  const handleTypeChange = (newType: string) => {
    setDeadlineType(newType as "none" | "preset" | "manual")

    if (newType === "none") {
      onValueChange(null)
    } else if (newType === "manual") {
      // Don't change value yet, wait for date selection
    }
  }

  const handlePresetChange = (newValue: string) => {
    if (newValue === "none") {
      onValueChange(null)
    } else if (newValue === "manual") {
      setDeadlineType("manual")
    } else {
      onValueChange(Number.parseInt(newValue, 10))
    }
  }

  const handleManualDateChange = (date: string) => {
    setManualDate(date)
    if (date) {
      const deadline = new Date(date + "T" + manualTime)
      onValueChange(deadline)
    }
  }

  const handleManualTimeChange = (time: string) => {
    setManualTime(time)
    if (manualDate) {
      const deadline = new Date(manualDate + "T" + time)
      onValueChange(deadline)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="deadline">Délai pour postuler</Label>
      <Select
        value={deadlineType === "manual" ? "manual" : stringValue}
        onValueChange={deadlineType === "manual" ? handleTypeChange : handlePresetChange}
      >
        <SelectTrigger id="deadline">
          <SelectValue placeholder="Aucun délai (automatique)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucun délai (automatique)</SelectItem>
          <SelectItem value="30">30 secondes (test)</SelectItem>
          <SelectItem value="900">15 minutes</SelectItem>
          <SelectItem value="86400">24 heures</SelectItem>
          <SelectItem value="manual">Deadline manuel</SelectItem>
        </SelectContent>
      </Select>

      {deadlineType === "manual" && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="space-y-2">
            <Label htmlFor="manual-date" className="text-sm">
              Date limite
            </Label>
            <div className="relative">
              <Input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => handleManualDateChange(e.target.value)}
                className="pl-9"
              />
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-time" className="text-sm">
              Heure limite (optionnelle, par défaut 17h00)
            </Label>
            <Input
              id="manual-time"
              type="time"
              value={manualTime}
              onChange={(e) => handleManualTimeChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
