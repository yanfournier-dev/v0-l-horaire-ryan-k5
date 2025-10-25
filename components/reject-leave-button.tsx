"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { rejectLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface RejectLeaveButtonProps {
  leaveId: number
}

export function RejectLeaveButton({ leaveId }: RejectLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await rejectLeave(leaveId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button onClick={handleReject} disabled={isLoading} size="sm" variant="destructive">
        {isLoading ? "Rejet..." : "Rejeter"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Rejeter la demande"
        description="Êtes-vous sûr de vouloir rejeter cette demande?"
        confirmText="Rejeter"
        cancelText="Annuler"
        onConfirm={handleConfirm}
        variant="destructive"
      />
    </>
  )
}
