"use client"

import { Button } from "@/components/ui/button"
import { createReplacementFromShift } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { parseLocalDate } from "@/lib/date-utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { TimePickerInput } from "@/components/time-picker-input"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"

interface CreateReplacementButtonProps {
  userId: number
  userName: string
  shiftDate: string
  shiftType: string
  teamId: number
}

export function CreateReplacementButton({
  userId,
  userName,
  shiftDate,
  shiftType,
  teamId,
}: CreateReplacementButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const defaultTimes = getDefaultReplacementTimes(shiftType)
  const [startTime, setStartTime] = useState(defaultTimes.startTime)
  const [endTime, setEndTime] = useState(defaultTimes.endTime)

  useEffect(() => {
    if (isPartial) {
      setStartTime(defaultTimes.startTime)
      setEndTime(defaultTimes.endTime)
    }
  }, [isPartial, defaultTimes.startTime, defaultTimes.endTime])

  const handleCreate = async () => {
    if (isLoading) return

    if (isPartial && (!startTime || !endTime)) {
      toast({
        title: "Erreur",
        description: "Veuillez spécifier les heures de début et de fin",
        variant: "destructive",
      })
      return
    }

    if (isPartial && startTime >= endTime) {
      toast({
        title: "Erreur",
        description: "L'heure de début doit être avant l'heure de fin",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await createReplacementFromShift(
        userId,
        shiftDate,
        shiftType,
        teamId,
        isPartial,
        isPartial ? startTime : undefined,
        isPartial ? endTime : undefined,
      )

      if (result.error) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Succès",
          description: "Demande de remplacement créée avec succès",
        })
        setOpen(false)
        setIsPartial(false)
        setStartTime(defaultTimes.startTime)
        setEndTime(defaultTimes.endTime)
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-red-600 hover:bg-red-700 text-white border-red-600">
          Créer remplacement
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créer une demande de remplacement</AlertDialogTitle>
          <AlertDialogDescription>
            Voulez-vous créer une demande de remplacement pour <strong>{userName}</strong> pour le quart du{" "}
            <strong>{parseLocalDate(shiftDate).toLocaleDateString("fr-CA")}</strong> (
            {shiftType === "day" ? "Jour" : shiftType === "full_24h" ? "24h" : "Nuit"} (
            {shiftType === "day" ? "7h-17h" : shiftType === "full_24h" ? "7h-7h" : "17h-7h"})) ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="partial"
              checked={isPartial}
              onCheckedChange={(checked) => {
                setIsPartial(checked as boolean)
              }}
            />
            <Label
              htmlFor="partial"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remplacement partiel
            </Label>
          </div>

          {isPartial && (
            <div className="space-y-3 pl-6">
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-sm">
                  Heure de début
                </Label>
                <TimePickerInput id="start-time" value={startTime} onChange={setStartTime} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-sm">
                  Heure de fin
                </Label>
                <TimePickerInput id="end-time" value={endTime} onChange={setEndTime} />
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Annuler</AlertDialogCancel>
          <Button onClick={handleCreate} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            {isLoading ? "Création..." : "Créer la demande"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
