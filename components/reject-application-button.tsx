"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { rejectApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface RejectApplicationButtonProps {
  applicationId: number
}

export function RejectApplicationButton({ applicationId }: RejectApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setIsLoading(true)
    await rejectApplication(applicationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button onClick={handleReject} disabled={isLoading} size="sm" variant="destructive" className="flex-1">
        {isLoading ? "Rejet..." : "Rejeter"}
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Rejeter la candidature"
        description="Êtes-vous sûr de vouloir rejeter cette candidature?"
        confirmText="Rejeter"
        cancelText="Annuler"
        onConfirm={handleConfirm}
        variant="destructive"
      />
    </>
  )
}
