"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { rejectLeave } from "@/app/actions/leaves"
import { toast } from "sonner"

interface RejectAbsenceButtonProps {
  leaveId: number
}

export function RejectAbsenceButton({ leaveId }: RejectAbsenceButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const handleReject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const reason = formData.get("reason") as string

    const result = await rejectLeave(leaveId, reason)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Absence rejetée")
      setShowDialog(false)
    }

    setLoading(false)
  }

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setShowDialog(true)}>
        Rejeter
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Rejeter l'absence</DialogTitle>
            <DialogDescription>Indiquez la raison du refus (optionnel)</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Raison du refus</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Expliquez pourquoi cette absence est refusée..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? "Rejet..." : "Rejeter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
