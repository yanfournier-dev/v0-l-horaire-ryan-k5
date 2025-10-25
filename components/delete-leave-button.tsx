"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface DeleteLeaveButtonProps {
  leaveId: number
  status: string
}

export function DeleteLeaveButton({ leaveId, status }: DeleteLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await deleteLeave(leaveId)
    setIsLoading(false)
    router.refresh()
  }

  const message =
    status === "approved"
      ? "Êtes-vous sûr de vouloir supprimer cette demande approuvée? Cette action est irréversible."
      : "Êtes-vous sûr de vouloir supprimer cette demande?"

  return (
    <>
      <Button onClick={handleDelete} disabled={isLoading} size="sm" variant="outline">
        {isLoading ? "Suppression..." : "Supprimer"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Supprimer la demande"
        description={message}
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={handleConfirm}
        variant="destructive"
      />
    </>
  )
}
