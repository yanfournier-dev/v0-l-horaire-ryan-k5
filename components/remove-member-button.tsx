"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { removeMemberFromTeam } from "@/app/actions/teams"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface RemoveMemberButtonProps {
  teamId: number
  userId: number
}

export function RemoveMemberButton({ teamId, userId }: RemoveMemberButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleRemove = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await removeMemberFromTeam(teamId, userId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={handleRemove} disabled={isLoading} className="w-full">
        {isLoading ? "Suppression..." : "Retirer de l'équipe"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Retirer le membre"
        description="Êtes-vous sûr de vouloir retirer ce membre de l'équipe?"
        confirmText="Retirer"
        cancelText="Annuler"
        onConfirm={handleConfirm}
        variant="destructive"
      />
    </>
  )
}
