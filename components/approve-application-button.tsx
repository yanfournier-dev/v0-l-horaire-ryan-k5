"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { approveApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { ConfirmPartialAssignmentDialog } from "@/components/confirm-partial-assignment-dialog"

interface ApproveApplicationButtonProps {
  applicationId: number
  firefighterName?: string
  isPartial?: boolean
  startTime?: string
  endTime?: string
}

export function ApproveApplicationButton({
  applicationId,
  firefighterName = "",
  isPartial = false,
  startTime,
  endTime,
}: ApproveApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    if (isPartial) {
      setShowConfirmDialog(true)
      return
    }

    await performApproval()
  }

  const performApproval = async () => {
    setIsLoading(true)
    setShowConfirmDialog(false)
    await approveApplication(applicationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={handleApprove}
        disabled={isLoading}
        size="sm"
        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
      >
        {isLoading ? "Approbation..." : "Approuver"}
      </Button>

      <ConfirmPartialAssignmentDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={performApproval}
        firefighterName={firefighterName}
        isPartial={isPartial}
        startTime={startTime}
        endTime={endTime}
      />
    </>
  )
}
