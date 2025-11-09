"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { reactivateApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface ReactivateApplicationButtonProps {
  applicationId: number
  replacementStatus: string
}

export function ReactivateApplicationButton({ applicationId, replacementStatus }: ReactivateApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  // Only show button if replacement is not assigned
  if (replacementStatus === "assigned") {
    return null
  }

  const handleReactivate = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await reactivateApplication(applicationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={handleReactivate}
        disabled={isLoading}
        size="sm"
        variant="outline"
        className="flex-1 bg-transparent"
      >
        {isLoading ? "Réactivation..." : "Réactiver"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Réactiver la candidature"
        description="Êtes-vous sûr de vouloir remettre cette candidature en attente?"
        confirmText="Réactiver"
        cancelText="Annuler"
        onConfirm={handleConfirm}
      />
    </>
  )
}
