"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { approveApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"

interface ApproveApplicationButtonProps {
  applicationId: number
}

export function ApproveApplicationButton({ applicationId }: ApproveApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)
    await approveApplication(applicationId)
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
      {isLoading ? "Approbation..." : "Approuver"}
    </Button>
  )
}
