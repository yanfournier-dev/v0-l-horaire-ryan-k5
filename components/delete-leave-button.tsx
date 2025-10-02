"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"

interface DeleteLeaveButtonProps {
  leaveId: number
}

export function DeleteLeaveButton({ leaveId }: DeleteLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette demande?")) {
      return
    }

    setIsLoading(true)
    await deleteLeave(leaveId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleDelete} disabled={isLoading} size="sm" variant="outline">
      {isLoading ? "Suppression..." : "Supprimer"}
    </Button>
  )
}
