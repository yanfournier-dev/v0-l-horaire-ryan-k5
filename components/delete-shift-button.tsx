"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteShift } from "@/app/actions/calendar"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface DeleteShiftButtonProps {
  shiftId: number
}

export function DeleteShiftButton({ shiftId }: DeleteShiftButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await deleteShift(shiftId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading} className="w-full">
        {isLoading ? "Suppression..." : "Supprimer"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Supprimer le quart"
        description="Êtes-vous sûr de vouloir supprimer ce quart?"
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={handleConfirm}
        variant="destructive"
      />
    </>
  )
}
