"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DeadlineSelectProps {
  value: number | null
  onValueChange: (value: number | null) => void
}

export function DeadlineSelect({ value, onValueChange }: DeadlineSelectProps) {
  const stringValue = value === null ? "none" : value.toString()

  const handleChange = (newValue: string) => {
    if (newValue === "none") {
      onValueChange(null)
    } else {
      onValueChange(Number.parseInt(newValue, 10))
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="deadline">Délai pour postuler (optionnel)</Label>
      <Select value={stringValue} onValueChange={handleChange}>
        <SelectTrigger id="deadline">
          <SelectValue placeholder="Aucun délai" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucun délai</SelectItem>
          <SelectItem value="30">30 secondes (test)</SelectItem>
          <SelectItem value="900">15 minutes</SelectItem>
          <SelectItem value="86400">24 heures</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
