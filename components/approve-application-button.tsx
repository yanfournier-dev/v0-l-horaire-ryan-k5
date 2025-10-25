"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { approveApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"

interface ApproveApplicationButtonProps {
  applicationId: number
  firefighterName?: string
  isPartial?: boolean
  startTime?: string | null
  endTime?: string | null
}

export function ApproveApplicationButton({
  applicationId,
  firefighterName,
  isPartial,
  startTime,
  endTime,
}: ApproveApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)
    const pathParts = window.location.pathname.split("/")
    const replacementId = Number.parseInt(pathParts[pathParts.length - 1])

    await approveApplication(applicationId, replacementId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button
      onClick={handleApprove}
      disabled={isLoading}
      size="sm"
      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
    >
      {isLoading ? "Assignation..." : "Assigner"}
    </Button>
  )
}
