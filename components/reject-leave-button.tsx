"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { rejectLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"

interface RejectLeaveButtonProps {
  leaveId: number
}

export function RejectLeaveButton({ leaveId }: RejectLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    if (!confirm("Êtes-vous sûr de vouloir rejeter cette demande?")) {
      return
    }

    setIsLoading(true)
    await rejectLeave(leaveId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleReject} disabled={isLoading} size="sm" variant="destructive">
      {isLoading ? "Rejet..." : "Rejeter"}
    </Button>
  )
}
