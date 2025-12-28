"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateLeave } from "@/app/actions/leaves"
import { toast } from "sonner"

interface EditAbsenceDialogProps {
  leave: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditAbsenceDialog({ leave, open, onOpenChange }: EditAbsenceDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
    const reason = formData.get("reason") as string

    const result = await updateLeave(leave.id, startDate, endDate, reason)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Absence modifiée avec succès")
      onOpenChange(false)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier l'absence</DialogTitle>
          <DialogDescription>Modifier les détails de cette absence</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={leave.start_date} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Date de fin</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={leave.end_date} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Motif de l'absence"
              defaultValue={leave.reason || ""}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
