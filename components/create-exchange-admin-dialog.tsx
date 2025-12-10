"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { TimePickerInput } from "@/components/time-picker-input"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"
import { Plus, AlertTriangle } from "lucide-react"
import {
  createExchangeAsAdmin,
  getUserShiftsForExchange,
  getAvailableFirefightersForExchange,
} from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface CreateExchangeAdminDialogProps {
  allFirefighters: any[]
}

export function CreateExchangeAdminDialog({ allFirefighters }: CreateExchangeAdminDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [autoApprove, setAutoApprove] = useState(true)
  const [showConsecutiveHoursAlert, setShowConsecutiveHoursAlert] = useState(false)
  const [consecutiveHoursData, setConsecutiveHoursData] = useState<{ message: string; maxHours: number } | null>(null)

  // Step 1: Select requester
  const [requesterId, setRequesterId] = useState<number | null>(null)
  const [requesterDate, setRequesterDate] = useState("")
  const [requesterShifts, setRequesterShifts] = useState<any[]>([])
  const [selectedRequesterShift, setSelectedRequesterShift] = useState<any>(null)
  const [isRequesterPartial, setIsRequesterPartial] = useState(false)
  const [requesterStartTime, setRequesterStartTime] = useState("")
  const [requesterEndTime, setRequesterEndTime] = useState("")

  // Step 2: Select target
  const [targetDate, setTargetDate] = useState("")
  const [availableFirefighters, setAvailableFirefighters] = useState<any[]>([])
  const [selectedTarget, setSelectedTarget] = useState<any>(null)
  const [isTargetPartial, setIsTargetPartial] = useState(false)
  const [targetStartTime, setTargetStartTime] = useState("")
  const [targetEndTime, setTargetEndTime] = useState("")

  const handleRequesterDateChange = async (date: string) => {
    setRequesterDate(date)
    setSelectedRequesterShift(null)

    if (requesterId && date) {
      const result = await getUserShiftsForExchange(requesterId, date)
      if (result.shifts) {
        setRequesterShifts(result.shifts)
      }
    }
  }

  const handleTargetDateChange = async (date: string) => {
    setTargetDate(date)
    setSelectedTarget(null)

    if (requesterId && selectedRequesterShift && date) {
      const result = await getAvailableFirefightersForExchange(requesterId, date, selectedRequesterShift.shift_type)
      if (result.firefighters) {
        setAvailableFirefighters(result.firefighters)
      }
    }
  }

  const handleSubmit = async (forceConsecutiveHours = false) => {
    if (!requesterId || !selectedRequesterShift || !selectedTarget) {
      alert("Veuillez remplir tous les champs")
      return
    }

    setLoading(true)

    const result = await createExchangeAsAdmin({
      requesterId,
      targetId: selectedTarget.id,
      requesterShiftDate: requesterDate,
      requesterShiftType: selectedRequesterShift.shift_type,
      requesterTeamId: selectedRequesterShift.team_id,
      targetShiftDate: targetDate,
      targetShiftType: selectedTarget.shift_type,
      targetTeamId: selectedTarget.team_id,
      isPartial: isRequesterPartial || isTargetPartial,
      requesterStartTime: isRequesterPartial ? requesterStartTime : undefined,
      requesterEndTime: isRequesterPartial ? requesterEndTime : undefined,
      targetStartTime: isTargetPartial ? targetStartTime : undefined,
      targetEndTime: isTargetPartial ? targetEndTime : undefined,
      autoApprove,
      forceConsecutiveHours,
    })

    setLoading(false)

    if (result.error) {
      if (result.error === "CONSECUTIVE_HOURS_EXCEEDED") {
        setConsecutiveHoursData({
          message: result.message || "Heures consécutives dépassées",
          maxHours: result.maxHours || 0,
        })
        setShowConsecutiveHoursAlert(true)
        return
      }
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Succès",
        description: autoApprove ? "Échange créé et approuvé avec succès" : "Demande d'échange créée avec succès",
      })
      setOpen(false)
      resetForm()
      router.refresh()
    }
  }

  const handleForceConsecutiveHours = async () => {
    setShowConsecutiveHoursAlert(false)
    await handleSubmit(true)
    setConsecutiveHoursData(null)
  }

  const resetForm = () => {
    setStep(1)
    setRequesterId(null)
    setRequesterDate("")
    setRequesterShifts([])
    setSelectedRequesterShift(null)
    setIsRequesterPartial(false)
    setRequesterStartTime("")
    setRequesterEndTime("")
    setTargetDate("")
    setAvailableFirefighters([])
    setSelectedTarget(null)
    setIsTargetPartial(false)
    setTargetStartTime("")
    setTargetEndTime("")
    setAutoApprove(true)
  }

  useEffect(() => {
    if (isRequesterPartial && selectedRequesterShift) {
      const defaultTimes = getDefaultReplacementTimes(selectedRequesterShift.shift_type)
      setRequesterStartTime(defaultTimes.startTime)
      setRequesterEndTime(defaultTimes.endTime)
    }
  }, [isRequesterPartial, selectedRequesterShift])

  useEffect(() => {
    if (isTargetPartial && selectedTarget) {
      const defaultTimes = getDefaultReplacementTimes(selectedTarget.shift_type)
      setTargetStartTime(defaultTimes.startTime)
      setTargetEndTime(defaultTimes.endTime)
    }
  }, [isTargetPartial, selectedTarget])

  const sortedFirefighters = [...allFirefighters].sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Créer un échange
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un échange de quart</DialogTitle>
            <DialogDescription>Créez un échange de quart entre deux pompiers (Étape {step}/3)</DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pompier demandeur</Label>
                <Select
                  value={requesterId?.toString()}
                  onValueChange={(value) => {
                    setRequesterId(Number(value))
                    setRequesterDate("")
                    setRequesterShifts([])
                    setSelectedRequesterShift(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un pompier" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedFirefighters.map((ff) => (
                      <SelectItem key={ff.id} value={ff.id.toString()}>
                        {ff.last_name} {ff.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requesterId && (
                <div className="space-y-2">
                  <Label>Date du quart à échanger</Label>
                  <input
                    type="date"
                    value={requesterDate}
                    onChange={(e) => handleRequesterDateChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}

              {requesterShifts.length > 0 && (
                <div className="space-y-2">
                  <Label>Quart à échanger</Label>
                  <Select
                    value={selectedRequesterShift?.id?.toString()}
                    onValueChange={(value) => {
                      const shift = requesterShifts.find((s) => s.id.toString() === value)
                      setSelectedRequesterShift(shift)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un quart" />
                    </SelectTrigger>
                    <SelectContent>
                      {requesterShifts.map((shift) => (
                        <SelectItem key={shift.id} value={shift.id.toString()}>
                          {shift.shift_type} - {shift.team_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedRequesterShift && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requesterPartial"
                      checked={isRequesterPartial}
                      onCheckedChange={(checked) => setIsRequesterPartial(checked as boolean)}
                    />
                    <Label htmlFor="requesterPartial" className="text-sm font-normal cursor-pointer">
                      Échange partiel (préciser les heures)
                    </Label>
                  </div>

                  {isRequesterPartial && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Heure de début</Label>
                        <TimePickerInput
                          id="requester-start"
                          value={requesterStartTime}
                          onChange={setRequesterStartTime}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Heure de fin</Label>
                        <TimePickerInput id="requester-end" value={requesterEndTime} onChange={setRequesterEndTime} />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button onClick={() => setStep(2)} disabled={!selectedRequesterShift}>
                  Suivant
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date du quart souhaité</Label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => handleTargetDateChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {availableFirefighters.length > 0 && (
                <div className="space-y-2">
                  <Label>Pompier avec qui échanger</Label>
                  <Select
                    value={selectedTarget?.id?.toString()}
                    onValueChange={(value) => {
                      const ff = availableFirefighters.find((f) => f.id.toString() === value)
                      setSelectedTarget(ff)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un pompier" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...availableFirefighters]
                        .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))
                        .map((ff) => (
                          <SelectItem key={ff.id} value={ff.id.toString()}>
                            {ff.last_name} {ff.first_name} - {ff.team_name} ({ff.shift_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTarget && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="targetPartial"
                      checked={isTargetPartial}
                      onCheckedChange={(checked) => setIsTargetPartial(checked as boolean)}
                    />
                    <Label htmlFor="targetPartial" className="text-sm font-normal cursor-pointer">
                      Échange partiel (préciser les heures)
                    </Label>
                  </div>

                  {isTargetPartial && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Heure de début</Label>
                        <TimePickerInput id="target-start" value={targetStartTime} onChange={setTargetStartTime} />
                      </div>
                      <div className="space-y-2">
                        <Label>Heure de fin</Label>
                        <TimePickerInput id="target-end" value={targetEndTime} onChange={setTargetEndTime} />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button onClick={() => setStep(3)} disabled={!selectedTarget}>
                  Suivant
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-medium">Résumé de l'échange</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Demandeur:</strong> {allFirefighters.find((f) => f.id === requesterId)?.last_name}{" "}
                    {allFirefighters.find((f) => f.id === requesterId)?.first_name}
                  </p>
                  <p>
                    <strong>Quart à échanger:</strong> {requesterDate} - {selectedRequesterShift?.shift_type}
                    {isRequesterPartial && ` (${requesterStartTime} - ${requesterEndTime})`}
                  </p>
                  <p className="mt-2">
                    <strong>Avec:</strong> {selectedTarget?.last_name} {selectedTarget?.first_name}
                  </p>
                  <p>
                    <strong>Quart souhaité:</strong> {targetDate} - {selectedTarget?.shift_type}
                    {isTargetPartial && ` (${targetStartTime} - ${targetEndTime})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoApprove"
                  checked={autoApprove}
                  onCheckedChange={(checked) => setAutoApprove(checked as boolean)}
                />
                <Label htmlFor="autoApprove" className="text-sm font-normal cursor-pointer">
                  Approuver automatiquement cet échange
                </Label>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Retour
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={loading}>
                  {loading ? "Création..." : "Créer l'échange"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showConsecutiveHoursAlert && (
        <Dialog open={showConsecutiveHoursAlert} onOpenChange={setShowConsecutiveHoursAlert}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Avertissement: Heures consécutives élevées
              </DialogTitle>
              <DialogDescription>
                <div className="space-y-2 mt-2">
                  <div className="text-foreground font-medium">{consecutiveHoursData?.message}</div>
                  <div className="text-sm">
                    Le pompier sélectionné travaillerait{" "}
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {consecutiveHoursData?.maxHours.toFixed(1)}h consécutives
                    </span>
                    , ce qui dépasse la limite recommandée de 38 heures.
                  </div>
                  <div className="text-sm font-medium mt-4">Voulez-vous quand même créer cet échange?</div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConsecutiveHoursAlert(false)
                  setConsecutiveHoursData(null)
                  setLoading(false)
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleForceConsecutiveHours} className="bg-orange-600 hover:bg-orange-700 text-white">
                Créer quand même
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
