"use client"

import { Button } from "@/components/ui/button"
import { deleteLeave } from "@/app/actions/leaves"
import { toast } from "sonner"
import { useState } from "react"

interface DeleteAbsenceButtonProps {
  leaveId: number
  status: string
}

export function DeleteAbsenceButton({ leaveId, status }: DeleteAbsenceButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const message =
      status === "approved"
        ? "Cette absence est approuvée. Voulez-vous vraiment la supprimer?"
        : "Voulez-vous supprimer cette absence?"

    if (!confirm(message)) return

    setLoading(true)
    const result = await deleteLeave(leaveId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Absence supprimée")
    }

    setLoading(false)
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDelete} disabled={loading}>
      {loading ? "Suppression..." : "Supprimer"}
    </Button>
  )
}
