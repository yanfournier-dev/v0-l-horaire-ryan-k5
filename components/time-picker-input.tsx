"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TimePickerInputProps {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
}

export function TimePickerInput({ value, onChange, id, required }: TimePickerInputProps) {
  // Generate time options in 15-minute increments
  const timeOptions: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      timeOptions.push(timeStr)
    }
  }

  return (
    <Select value={value} onValueChange={onChange} required={required}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Sélectionner l'heure" />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {timeOptions.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
