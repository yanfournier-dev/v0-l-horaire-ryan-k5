"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus } from "lucide-react"
import {
  createExchangeAsAdmin,
  getUserShiftsForExchange,
  getAvailableFirefightersForExchange,
} from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"

interface CreateExchangeAdminDialogProps {
  allFirefighters: any[]
}

export function CreateExchangeAdminDialog({ allFirefighters }: CreateExchangeAdminDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Select requester
  const [requesterId, setRequesterId] = useState<number | null>(null)
  const [requesterDate, setRequesterDate] = useState("")
  const [requesterShifts, setRequesterShifts] = useState<any[]>([])
  const [selectedRequesterShift, setSelectedRequesterShift] = useState<any>(null)

  // Step 2: Select target
  const [targetDate, setTargetDate] = useState("")
  const [availableFirefighters, setAvailableFirefighters] = useState<any[]>([])
  const [selectedTarget, setSelectedTarget] = useState<any>(null)

  // Step 3: Options
  const [autoApprove, setAutoApprove] = useState(true)

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

  const handleSubmit = async () => {
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
      isPartial: false,
      autoApprove,
    })

    setLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      setOpen(false)
      resetForm()
      router.refresh()
    }
  }

  const resetForm = () => {
    setStep(1)
    setRequesterId(null)
    setRequesterDate("")
    setRequesterShifts([])
    setSelectedRequesterShift(null)
    setTargetDate("")
    setAvailableFirefighters([])
    setSelectedTarget(null)
    setAutoApprove(true)
  }

  return (
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
                  {allFirefighters.map((ff) => (
                    <SelectItem key={ff.id} value={ff.id.toString()}>
                      {ff.first_name} {ff.last_name}
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
                    {availableFirefighters.map((ff) => (
                      <SelectItem key={ff.id} value={ff.id.toString()}>
                        {ff.first_name} {ff.last_name} - {ff.team_name} ({ff.shift_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <strong>Demandeur:</strong> {allFirefighters.find((f) => f.id === requesterId)?.first_name}{" "}
                  {allFirefighters.find((f) => f.id === requesterId)?.last_name}
                </p>
                <p>
                  <strong>Quart à échanger:</strong> {requesterDate} - {selectedRequesterShift?.shift_type}
                </p>
                <p className="mt-2">
                  <strong>Avec:</strong> {selectedTarget?.first_name} {selectedTarget?.last_name}
                </p>
                <p>
                  <strong>Quart souhaité:</strong> {targetDate} - {selectedTarget?.shift_type}
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
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Création..." : "Créer l'échange"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
