"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"

interface DeleteLeaveButtonProps {
  leaveId: number
  status: string
}

export function DeleteLeaveButton({ leaveId, status }: DeleteLeaveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const message =
      status === "approved"
        ? "Êtes-vous sûr de vouloir supprimer cette demande approuvée? Cette action est irréversible."
        : "Êtes-vous sûr de vouloir supprimer cette demande?"

    if (!confirm(message)) {
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
