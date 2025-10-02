"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteFirefighter } from "@/app/actions/teams"
import { useRouter } from "next/navigation"

interface DeleteFirefighterButtonProps {
  userId: number
}

export function DeleteFirefighterButton({ userId }: DeleteFirefighterButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pompier? Cette action est irréversible.")) {
      return
    }

    setIsLoading(true)
    await deleteFirefighter(userId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading} className="flex-1">
      {isLoading ? "Suppression..." : "Supprimer"}
    </Button>
  )
}
