"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { approveLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"

interface ApproveLeaveButtonProps {
  leaveId: number
}

export function ApproveLeaveButton({ leaveId }: ApproveLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)
    await approveLeave(leaveId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button
      onClick={handleApprove}
      disabled={isLoading}
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      {isLoading ? "Approbation..." : "Approuver"}
    </Button>
  )
}
