"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TimePickerInput } from "@/components/time-picker-input"
import { requestReplacement } from "@/app/actions/replacements"
import { getUserAssignedShifts } from "@/app/actions/shift-assignments"
import { useRouter } from "next/navigation"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"

interface RequestReplacementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
}

interface AssignedShift {
  id: number
  shift_type: string
  cycle_day: number
  team_id: number
  start_time: string
  end_time: string
  team_name: string
  team_color: string
}

export function RequestReplacementDialog({ open, onOpenChange, userId }: RequestReplacementDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [assignedShifts, setAssignedShifts] = useState<AssignedShift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState("")
  const [isPartial, setIsPartial] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  useEffect(() => {
    if (selectedDate) {
      setLoadingShifts(true)
      getUserAssignedShifts(userId, selectedDate).then((shifts) => {
        setAssignedShifts(shifts as AssignedShift[])
        setLoadingShifts(false)
        setSelectedShiftId("") // Reset shift selection when date changes
      })
    } else {
      setAssignedShifts([])
      setSelectedShiftId("")
    }
  }, [selectedDate, userId])

  useEffect(() => {
    if (open) {
      setSelectedDate("")
      setAssignedShifts([])
      setSelectedShiftId("")
      setIsPartial(false)
      setStartTime("")
      setEndTime("")
    }
  }, [open])

  useEffect(() => {
    if (isPartial && selectedShiftId) {
      const selectedShift = assignedShifts.find((s) => s.id.toString() === selectedShiftId)

      if (selectedShift) {
        const { startTime: defaultStart, endTime: defaultEnd } = getDefaultReplacementTimes(selectedShift.shift_type)
        setStartTime(defaultStart)
        setEndTime(defaultEnd)
      }
    } else if (!isPartial) {
      setStartTime("")
      setEndTime("")
    }
  }, [isPartial, selectedShiftId, assignedShifts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const selectedShift = assignedShifts.find((s) => s.id.toString() === selectedShiftId)
    if (!selectedShift || !selectedDate) {
      alert("Veuillez sélectionner une date et un quart")
      setLoading(false)
      return
    }

    if (isPartial && (!startTime || !endTime)) {
      alert("Veuillez spécifier les heures de début et de fin pour un remplacement partiel")
      setLoading(false)
      return
    }

    const result = await requestReplacement(
      selectedDate,
      selectedShift.shift_type,
      selectedShift.team_id,
      isPartial,
      isPartial ? startTime : undefined,
      isPartial ? endTime : undefined,
    )

    if (result.error) {
      alert(result.error)
    } else {
      onOpenChange(false)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Demander un remplacement</DialogTitle>
          <DialogDescription>
            Sélectionnez une date et un quart où vous êtes assigné pour demander un remplacement. Un administrateur
            devra approuver votre demande.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date-select">Date du quart</Label>
            <Input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift-select">Quart assigné</Label>
            <Select
              value={selectedShiftId}
              onValueChange={setSelectedShiftId}
              disabled={!selectedDate || loadingShifts}
            >
              <SelectTrigger id="shift-select">
                <SelectValue placeholder={loadingShifts ? "Chargement..." : "Sélectionnez un quart"} />
              </SelectTrigger>
              <SelectContent>
                {assignedShifts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {selectedDate ? "Aucun quart assigné pour cette date" : "Sélectionnez d'abord une date"}
                  </SelectItem>
                ) : (
                  assignedShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id.toString()}>
                      {shift.shift_type === "day" ? "Jour" : shift.shift_type === "full_24h" ? "24h" : "Nuit"} -{" "}
                      {shift.team_name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-partial"
              checked={isPartial}
              onCheckedChange={(checked) => setIsPartial(checked === true)}
            />
            <Label htmlFor="is-partial" className="text-sm font-normal">
              Remplacement partiel (préciser les heures)
            </Label>
          </div>

          {isPartial && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Heure de début</Label>
                <TimePickerInput id="start-time" value={startTime} onChange={setStartTime} required={isPartial} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Heure de fin</Label>
                <TimePickerInput id="end-time" value={endTime} onChange={setEndTime} required={isPartial} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !selectedDate || !selectedShiftId}>
              {loading ? "Envoi..." : "Envoyer la demande"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
