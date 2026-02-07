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
import { LeaveBankSelector } from "@/components/leave-bank-selector"
import { useToast } from "@/hooks/use-toast"

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
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [assignedShifts, setAssignedShifts] = useState<AssignedShift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState("")
  const [isPartial, setIsPartial] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [leaveBank1, setLeaveBank1] = useState("")
  const [leaveHours1, setLeaveHours1] = useState("")
  const [leaveBank2, setLeaveBank2] = useState("")
  const [leaveHours2, setLeaveHours2] = useState("")

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
      setLeaveBank1("")
      setLeaveHours1("")
      setLeaveBank2("")
      setLeaveHours2("")
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
    console.log("[v0] RequestReplacementDialog - handleSubmit triggered")
    e.preventDefault()
    setLoading(true)

    const selectedShift = assignedShifts.find((s) => s.id.toString() === selectedShiftId)
    console.log("[v0] RequestReplacementDialog - Selected shift:", selectedShift)
    console.log("[v0] RequestReplacementDialog - Selected date:", selectedDate)
    
    if (!selectedShift || !selectedDate) {
      console.log("[v0] RequestReplacementDialog - Missing shift or date")
      alert("Veuillez sélectionner une date et un quart")
      setLoading(false)
      return
    }

    if (isPartial && (!startTime || !endTime)) {
      console.log("[v0] RequestReplacementDialog - Missing partial times")
      alert("Veuillez spécifier les heures de début et de fin pour un remplacement partiel")
      setLoading(false)
      return
    }

    console.log("[v0] RequestReplacementDialog - Calling requestReplacement with:", {
      selectedDate,
      shiftType: selectedShift.shift_type,
      teamId: selectedShift.team_id,
      isPartial,
      startTime,
      endTime,
      leaveBank1,
      leaveHours1,
      leaveBank2,
      leaveHours2,
    })

    const result = await requestReplacement(
      selectedDate,
      selectedShift.shift_type,
      selectedShift.team_id,
      isPartial,
      isPartial ? startTime : undefined,
      isPartial ? endTime : undefined,
      selectedShift.start_time,
      selectedShift.end_time,
      leaveBank1 && leaveBank1 !== "none" ? leaveBank1 : null,
      leaveHours1 && leaveHours1 !== "none" ? leaveHours1 : null,
      leaveBank2 && leaveBank2 !== "none" ? leaveBank2 : null,
      leaveHours2 && leaveHours2 !== "none" ? leaveHours2 : null,
    )

    console.log("[v0] RequestReplacementDialog - Result received:", result)

    if (result.error) {
      console.log("[v0] RequestReplacementDialog - Showing error toast")
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      })
    } else {
      console.log("[v0] RequestReplacementDialog - Showing success toast")
      toast({
        title: "Demande envoyée",
        description: "Votre demande de remplacement a été envoyée avec succès.",
      })
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

          <LeaveBankSelector
            bank1={leaveBank1}
            hours1={leaveHours1}
            bank2={leaveBank2}
            hours2={leaveHours2}
            onBank1Change={setLeaveBank1}
            onHours1Change={setLeaveHours1}
            onBank2Change={setLeaveBank2}
            onHours2Change={setLeaveHours2}
          />

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
