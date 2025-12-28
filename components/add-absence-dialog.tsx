"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createLeaveRequest } from "@/app/actions/leaves"
import { toast } from "sonner"

interface AddAbsenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  firefighters: any[]
  userId: number
}

export function AddAbsenceDialog({ open, onOpenChange, isAdmin, firefighters, userId }: AddAbsenceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(userId.toString())

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    if (isAdmin) {
      formData.set("userId", selectedUserId)
    }

    const result = await createLeaveRequest(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Absence créée avec succès")
      setSelectedUserId(userId.toString())
      onOpenChange(false)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une absence</DialogTitle>
          <DialogDescription>Créer une nouvelle demande d'absence</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="userId">Pompier</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {firefighters.map((ff: any) => (
                    <SelectItem key={ff.id} value={ff.id.toString()}>
                      {ff.first_name} {ff.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Date de fin</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea id="reason" name="reason" placeholder="Motif de l'absence" rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
