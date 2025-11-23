"use client"

import { useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DeadlineSelect } from "@/components/deadline-select"
import { addSecondReplacement } from "@/app/actions/direct-assignments"
import { createSecondReplacementRequest } from "@/app/actions/replacements"
import { toast } from "sonner"

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
  const [assignmentType, setAssignmentType] = useState<"direct" | "request">("direct")
  const [deadlineSeconds, setDeadlineSeconds] = useState<number | null | Date | null>(null)
  const [selectedFirefighter, setSelectedFirefighter] = useState<number | null>(null)
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("17:00")
  const [isLoading, setIsLoading] = useState(false)

  const generateTimeOptions = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        times.push(timeString)
      }
    }
    return times
  }

  const handleSubmit = async () => {
    if (assignmentType === "direct") {
      if (!selectedFirefighter) {
        toast.error("Veuillez sélectionner un pompier")
        return
      }
    }

    if (startTime >= endTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    setIsLoading(true)

    if (assignmentType === "request") {
      if (!deadlineSeconds) {
        toast.error("Veuillez sélectionner une date limite")
        setIsLoading(false)
        return
      }

      const result = await createSecondReplacementRequest({
        shiftId: shift.id,
        replacedUserId: replacedFirefighter.id,
        shiftDate: shift.date?.toISOString().split("T")[0] || "",
        shiftType: shift.shift_type as "day" | "night" | "full_24h",
        startTime,
        endTime,
        deadlineSeconds,
      })

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Demande de remplacement créée avec succès")
      setIsLoading(false)
      onOpenChange(false)
      onSuccess()
      return
    }

    const result = await addSecondReplacement({
      shiftId: shift.id,
      replacedUserId: replacedFirefighter.id,
      assignedUserId: selectedFirefighter!,
      startTime,
      endTime,
    })

    if (result.error) {
      toast.error(result.error)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un Remplaçant 2</DialogTitle>
          <DialogDescription>
            Ajouter un deuxième remplaçant pour {replacedFirefighter.first_name} {replacedFirefighter.last_name} sur ce
            quart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Type d'assignation</Label>
            <RadioGroup value={assignmentType} onValueChange={(v) => setAssignmentType(v as "direct" | "request")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="direct" id="direct" />
                <Label htmlFor="direct" className="font-normal cursor-pointer">
                  Assignation directe (choisir un pompier)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="request" id="request" />
                <Label htmlFor="request" className="font-normal cursor-pointer">
                  Demande de remplacement (les pompiers pourront postuler)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {assignmentType === "direct" && (
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
          )}

          {assignmentType === "request" && (
            <DeadlineSelect
              value={deadlineSeconds}
              onValueChange={setDeadlineSeconds}
              shiftDate={shift.date}
              shiftEndTime={endTime}
              isPartial={true}
              partialEndTime={endTime}
              shift={shift}
            />
          )}

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
  )
}
