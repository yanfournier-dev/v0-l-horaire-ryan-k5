"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { addSecondReplacement } from "@/app/actions/direct-assignments"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

interface AddSecondReplacementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: {
    id: number
    shift_type: string
    date?: Date
    start_time?: string
    end_time?: string
  }
  replacedFirefighter: {
    id: number
    first_name: string
    last_name: string
  }
  firstReplacementUserId: number
  allFirefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  onSuccess: () => void
}

export function AddSecondReplacementDialog({
  open,
  onOpenChange,
  shift,
  replacedFirefighter,
  firstReplacementUserId,
  allFirefighters,
  onSuccess,
}: AddSecondReplacementDialogProps) {
  const [selectedFirefighter, setSelectedFirefighter] = useState<number | null>(null)

  // Calculate default times based on shift_type
  const getDefaultTimes = () => {
    console.log("[v0] getDefaultTimes - shift object:", shift)
    console.log("[v0] getDefaultTimes - shift.shift_type:", shift.shift_type)
    switch (shift.shift_type) {
      case "night":
        console.log("[v0] getDefaultTimes returning night times: 17:00-07:00")
        return { start: "17:00", end: "07:00" }
      case "full_24h":
        console.log("[v0] getDefaultTimes returning full_24h times: 07:00-07:00")
        return { start: "07:00", end: "07:00" }
      case "day":
      default:
        console.log("[v0] getDefaultTimes returning day times: 07:00-17:00")
        return { start: "07:00", end: "17:00" }
    }
  }

  const defaultTimes = getDefaultTimes()
  const [startTime, setStartTime] = useState(defaultTimes.start)
  const [endTime, setEndTime] = useState(defaultTimes.end)
  const [isLoading, setIsLoading] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Update default times whenever shift changes or dialog opens
  useEffect(() => {
    if (open) {
      console.log("[v0] Dialog opened, recalculating default times for shift_type:", shift.shift_type)
      const newDefaultTimes = getDefaultTimes()
      setStartTime(newDefaultTimes.start)
      setEndTime(newDefaultTimes.end)
      setSelectedFirefighter(null)
    }
  }, [open, shift])

  const generateTimeOptions = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        times.push(timeString)
      }
    }
    return times
  }

  const handleSubmit = async () => {
    if (!selectedFirefighter) {
      toast.error("Veuillez sélectionner un pompier")
      return
    }

    // For night shifts (17:00-07:00), startTime can be >= endTime (crossing midnight)
    // Just warn if they are the same
    if (startTime === endTime) {
      toast.error("L'heure de début et de fin ne peuvent pas être identiques")
      return
    }

    setIsLoading(true)

    const shiftDateStr = shift.date
      ? `${shift.date.getFullYear()}-${String(shift.date.getMonth() + 1).padStart(2, "0")}-${String(shift.date.getDate()).padStart(2, "0")}`
      : undefined
    console.log("[v0] AddSecondReplacementDialog - shift.date:", shift.date, "converted to:", shiftDateStr)

    // Ensure times are in HH:MM:SS format
    const formatTime = (time: string) => {
      if (time.length === 5) return `${time}:00` // HH:MM -> HH:MM:SS
      return time
    }

    const result = await addSecondReplacement({
      shiftId: shift.id,
      replacedUserId: replacedFirefighter.id,
      assignedUserId: selectedFirefighter,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      shiftDate: shiftDateStr,
    })

    console.log("[v0] addSecondReplacement result:", result)

    if (!result.success || result.error) {
      const errorMsg = result.error || "Une erreur est survenue"
      console.error("[v0] Error adding second replacement:", errorMsg)

      setErrorMessage(errorMsg)
      setErrorDialogOpen(true)
      setIsLoading(false)
      return
    }

    toast.success("Remplaçant 2 ajouté avec succès")
    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  const availableFirefighters = allFirefighters
    .filter((ff) => ff.id !== firstReplacementUserId && ff.id !== replacedFirefighter.id)
    .sort((a, b) => {
      const lastNameCompare = a.last_name.localeCompare(b.last_name, "fr")
      if (lastNameCompare !== 0) return lastNameCompare
      return a.first_name.localeCompare(b.first_name, "fr")
    })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un Remplaçant 2</DialogTitle>
            <DialogDescription>
              Ajouter un deuxième remplaçant pour {replacedFirefighter.first_name} {replacedFirefighter.last_name} sur
              ce quart.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sélectionner le pompier</Label>
              <Select
                value={selectedFirefighter?.toString() || ""}
                onValueChange={(value) => setSelectedFirefighter(Number.parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un pompier" />
                </SelectTrigger>
                <SelectContent>
                  {availableFirefighters.map((ff) => (
                    <SelectItem key={ff.id} value={ff.id.toString()}>
                      {ff.first_name} {ff.last_name} - {ff.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-time">Heure de début</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-time">Heure de fin</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="end-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-red-900">Configuration non supportée</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 leading-relaxed">{errorMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700 w-full">
              J'ai compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
