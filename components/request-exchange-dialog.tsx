"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import {
  getUserShiftsForExchange,
  getAvailableFirefightersForExchange,
  createExchangeRequest,
  getUserExchangeCount,
} from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

interface RequestExchangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
}

export function RequestExchangeDialog({ open, onOpenChange, userId }: RequestExchangeDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Select own shift
  const [myShiftDate, setMyShiftDate] = useState("")
  const [myShifts, setMyShifts] = useState<any[]>([])
  const [selectedMyShift, setSelectedMyShift] = useState<any>(null)
  const [myIsPartial, setMyIsPartial] = useState(false)
  const [myStartTime, setMyStartTime] = useState("")
  const [myEndTime, setMyEndTime] = useState("")

  // Step 2: Select target firefighter and shift
  const [targetDate, setTargetDate] = useState("")
  const [availableFirefighters, setAvailableFirefighters] = useState<any[]>([])
  const [selectedFirefighter, setSelectedFirefighter] = useState<any>(null)
  const [targetIsPartial, setTargetIsPartial] = useState(false)
  const [targetStartTime, setTargetStartTime] = useState("")
  const [targetEndTime, setTargetEndTime] = useState("")

  const [exchangeCount, setExchangeCount] = useState(0)
  const [exchangeYear, setExchangeYear] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setStep(1)
      setMyShiftDate("")
      setMyShifts([])
      setSelectedMyShift(null)
      setMyIsPartial(false)
      setMyStartTime("")
      setMyEndTime("")
      setTargetDate("")
      setAvailableFirefighters([])
      setSelectedFirefighter(null)
      setTargetIsPartial(false)
      setTargetStartTime("")
      setTargetEndTime("")
      setExchangeCount(0)
      setExchangeYear(null)
    }
  }, [open])

  useEffect(() => {
    if (myShiftDate) {
      getUserShiftsForExchange(userId, myShiftDate).then((result) => {
        if (result.shifts) {
          setMyShifts(result.shifts)
        }
      })

      const year = new Date(myShiftDate).getFullYear()
      setExchangeYear(year)
      getUserExchangeCount(userId, year).then((result) => {
        setExchangeCount(result.count || 0)
      })
    }
  }, [myShiftDate, userId])

  useEffect(() => {
    if (targetDate && selectedMyShift) {
      getAvailableFirefightersForExchange(userId, targetDate, selectedMyShift.shift_type).then((result) => {
        if (result.firefighters) {
          setAvailableFirefighters(result.firefighters)
        }
      })
    }
  }, [targetDate, selectedMyShift, userId])

  const handleNext = () => {
    if (step === 1 && selectedMyShift) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSubmit = async () => {
    if (!selectedMyShift || !selectedFirefighter) return

    setLoading(true)

    const result = await createExchangeRequest({
      targetId: selectedFirefighter.id,
      requesterShiftDate: myShiftDate,
      requesterShiftType: selectedMyShift.shift_type,
      requesterTeamId: selectedMyShift.team_id,
      targetShiftDate: targetDate,
      targetShiftType: selectedFirefighter.shift_type,
      targetTeamId: selectedFirefighter.team_id,
      isPartial: myIsPartial || targetIsPartial,
      requesterStartTime: myIsPartial ? myStartTime : undefined,
      requesterEndTime: myIsPartial ? myEndTime : undefined,
      targetStartTime: targetIsPartial ? targetStartTime : undefined,
      targetEndTime: targetIsPartial ? targetEndTime : undefined,
    })

    if (result.error) {
      alert(result.error)
    } else {
      if (result.warning) {
        alert(result.warning)
      }
      onOpenChange(false)
      router.refresh()
    }

    setLoading(false)
  }

  const getShiftTypeLabel = (type: string) => {
    switch (type) {
      case "day":
        return "Jour"
      case "night":
        return "Nuit"
      case "full_24h":
        return "24h"
      default:
        return type
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Demander un échange de quart - Étape {step}/2</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Sélectionnez le quart que vous souhaitez échanger"
              : "Sélectionnez le pompier et le quart que vous souhaitez obtenir"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {exchangeYear && exchangeCount >= 8 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Vous avez déjà {exchangeCount} échanges approuvés pour l'année {exchangeYear}. La limite recommandée
                  est de 8 échanges par année. Vous pouvez continuer, mais cela dépassera la limite.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="my-date">Date de votre quart</Label>
              <Input
                id="my-date"
                type="date"
                value={myShiftDate}
                onChange={(e) => setMyShiftDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
              {exchangeYear && (
                <p className="text-xs text-muted-foreground">
                  Échanges approuvés en {exchangeYear}: {exchangeCount}/8
                </p>
              )}
            </div>

            {myShifts.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="my-shift">Votre quart</Label>
                <Select
                  value={selectedMyShift?.id?.toString()}
                  onValueChange={(value) => {
                    const shift = myShifts.find((s) => s.id.toString() === value)
                    setSelectedMyShift(shift)
                  }}
                >
                  <SelectTrigger id="my-shift">
                    <SelectValue placeholder="Sélectionnez votre quart" />
                  </SelectTrigger>
                  <SelectContent>
                    {myShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id.toString()}>
                        {getShiftTypeLabel(shift.shift_type)} - {shift.team_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedMyShift && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="my-partial"
                    checked={myIsPartial}
                    onCheckedChange={(checked) => setMyIsPartial(checked === true)}
                  />
                  <Label htmlFor="my-partial" className="text-sm font-normal">
                    Échange partiel (préciser les heures)
                  </Label>
                </div>

                {myIsPartial && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="my-start">Heure de début</Label>
                      <Input
                        id="my-start"
                        type="time"
                        value={myStartTime}
                        onChange={(e) => setMyStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="my-end">Heure de fin</Label>
                      <Input
                        id="my-end"
                        type="time"
                        value={myEndTime}
                        onChange={(e) => setMyEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!selectedMyShift} className="gap-2">
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-1">Votre quart à échanger:</p>
              <p className="text-sm text-muted-foreground">
                {new Date(myShiftDate).toLocaleDateString("fr-CA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                - {getShiftTypeLabel(selectedMyShift.shift_type)}
                {myIsPartial && ` (${myStartTime} - ${myEndTime})`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-date">Date du quart souhaité</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            {availableFirefighters.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="target-firefighter">Pompier</Label>
                <Select
                  value={selectedFirefighter?.id?.toString()}
                  onValueChange={(value) => {
                    const firefighter = availableFirefighters.find((f) => f.id.toString() === value)
                    setSelectedFirefighter(firefighter)
                  }}
                >
                  <SelectTrigger id="target-firefighter">
                    <SelectValue placeholder="Sélectionnez un pompier" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...availableFirefighters]
                      .sort((a, b) => a.first_name.localeCompare(b.first_name, "fr"))
                      .map((firefighter) => (
                        <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                          {firefighter.first_name} {firefighter.last_name} - {getShiftTypeLabel(firefighter.shift_type)}{" "}
                          ({firefighter.team_name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedFirefighter && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="target-partial"
                    checked={targetIsPartial}
                    onCheckedChange={(checked) => setTargetIsPartial(checked === true)}
                  />
                  <Label htmlFor="target-partial" className="text-sm font-normal">
                    Échange partiel (préciser les heures)
                  </Label>
                </div>

                {targetIsPartial && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-start">Heure de début</Label>
                      <Input
                        id="target-start"
                        type="time"
                        value={targetStartTime}
                        onChange={(e) => setTargetStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target-end">Heure de fin</Label>
                      <Input
                        id="target-end"
                        type="time"
                        value={targetEndTime}
                        onChange={(e) => setTargetEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleBack}>
                Retour
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !selectedFirefighter}>
                {loading ? "Envoi..." : "Envoyer la demande"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
