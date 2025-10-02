"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteShift } from "@/app/actions/calendar"
import { useRouter } from "next/navigation"

interface DeleteShiftButtonProps {
  shiftId: number
}

export function DeleteShiftButton({ shiftId }: DeleteShiftButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce quart?")) {
      return
    }

    setIsLoading(true)
    await deleteShift(shiftId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading} className="w-full">
      {isLoading ? "Suppression..." : "Supprimer"}
    </Button>
  )
}
