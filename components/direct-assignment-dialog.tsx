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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createDirectAssignment } from "@/app/actions/direct-assignments"
import { toast } from "sonner"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DirectAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: {
    id: number
    team_id: number
    shift_type: string
    date: Date
  } | null
  teamFirefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  allFirefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  onSuccess: () => void
  preSelectedFirefighter?: { id: number; first_name: string; last_name: string } | null
}

export function DirectAssignmentDialog({
  open,
  onOpenChange,
  shift,
  teamFirefighters,
  allFirefighters,
  onSuccess,
  preSelectedFirefighter,
}: DirectAssignmentDialogProps) {
  const [assignedFirefighter, setAssignedFirefighter] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("17:00")
  const [showWarning, setShowWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState("")
  const [warningHours, setWarningHours] = useState(0)

  useEffect(() => {
    if (open && shift) {
      setIsPartial(false)
      setAssignedFirefighter(null)
    }
  }, [open, shift])

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
    if (!shift || !preSelectedFirefighter || !assignedFirefighter) {
      toast.error("Veuillez remplir tous les champs requis")
      return
    }

    if (isPartial && startTime >= endTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      console.log("[v0] DirectAssignmentDialog - saving scroll before createDirectAssignment:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    setIsLoading(true)

    try {
      const shiftDateStr = `${shift.date.getFullYear()}-${String(shift.date.getMonth() + 1).padStart(2, "0")}-${String(shift.date.getDate()).padStart(2, "0")}`
      console.log("[v0] DirectAssignmentDialog - shift.date:", shift.date, "converted to:", shiftDateStr)
      console.log("[v0] DirectAssignmentDialog - Creating direct assignment:", {
        shiftId: shift.id,
        replacedUserId: preSelectedFirefighter.id,
        assignedUserId: assignedFirefighter,
        isPartial,
      })

      const result = await createDirectAssignment({
        shiftId: shift.id,
        replacedUserId: preSelectedFirefighter.id,
        assignedUserId: assignedFirefighter,
        isPartial,
        startTime: isPartial ? startTime : undefined,
        endTime: isPartial ? endTime : undefined,
        shiftDate: shiftDateStr,
      })

      console.log("[v0] DirectAssignmentDialog - createDirectAssignment result:", result)

      if (result.error === "CONSECUTIVE_HOURS_EXCEEDED") {
        setWarningMessage(result.message || "")
        setWarningHours(result.totalHours || 0)
        setShowWarning(true)
        setIsLoading(false)
        return
      }

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Pompier assigné directement avec succès")
      console.log("[v0] DirectAssignmentDialog - Closing dialog and calling onSuccess")
      onOpenChange(false)
      setIsLoading(false)
      setTimeout(() => {
        console.log("[v0] DirectAssignmentDialog - Calling onSuccess callback")
        onSuccess()
      }, 100)
    } catch (error) {
      console.error("[v0] DirectAssignmentDialog - Error:", error)
      toast.error("Erreur lors de l'assignation")
      setIsLoading(false)
    }
  }

  const handleForceAssign = async () => {
    // TODO: Implement force assign logic with override flag
    toast.info("Fonction de forçage en développement")
    setShowWarning(false)
  }

  const sortedAllFirefighters = [...allFirefighters].sort((a, b) => {
    const lastNameCompare = a.last_name.localeCompare(b.last_name, "fr")
    if (lastNameCompare !== 0) return lastNameCompare
    return a.first_name.localeCompare(b.first_name, "fr")
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assigner directement un pompier</DialogTitle>
            <DialogDescription>
              {preSelectedFirefighter && shift && (
                <span>
                  Remplacer{" "}
                  <strong>
                    {preSelectedFirefighter.first_name} {preSelectedFirefighter.last_name}
                  </strong>{" "}
                  par un autre pompier pour le <strong>{format(shift.date, "d MMMM yyyy", { locale: fr })}</strong>.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assigned-firefighter">Pompier assigné (remplaçant)</Label>
              <Select
                value={assignedFirefighter?.toString() || ""}
                onValueChange={(value) => setAssignedFirefighter(Number.parseInt(value))}
              >
                <SelectTrigger id="assigned-firefighter">
                  <SelectValue placeholder="Sélectionner un pompier" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAllFirefighters.map((ff) => (
                    <SelectItem key={ff.id} value={ff.id.toString()}>
                      {ff.first_name} {ff.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="partial"
                checked={isPartial}
                onCheckedChange={(checked) => setIsPartial(checked === true)}
              />
              <Label
                htmlFor="partial"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Assignation partielle
              </Label>
            </div>

            {isPartial && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-sm">
                    Heure de début
                  </Label>
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
                  <Label htmlFor="end-time" className="text-sm">
                    Heure de fin
                  </Label>
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
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">
              ⚠️ Avertissement: Heures consécutives élevées
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-foreground font-medium">{warningMessage}</div>
              <div className="text-sm">
                Le pompier sélectionné travaillerait{" "}
                <strong className="text-orange-600">{warningHours}h consécutives</strong>, ce qui dépasse la limite
                recommandée de 38 heures.
              </div>
              <div className="text-sm text-muted-foreground">Voulez-vous quand même assigner ce pompier?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceAssign} className="bg-orange-600 hover:bg-orange-700">
              Assigner quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
