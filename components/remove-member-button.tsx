"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { removeMemberFromTeam } from "@/app/actions/teams"
import { useRouter } from "next/navigation"

interface RemoveMemberButtonProps {
  teamId: number
  userId: number
}

export function RemoveMemberButton({ teamId, userId }: RemoveMemberButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRemove = async () => {
    if (!confirm("Êtes-vous sûr de vouloir retirer ce membre de l'équipe?")) {
      return
    }

    setIsLoading(true)
    await removeMemberFromTeam(teamId, userId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleRemove} disabled={isLoading} className="w-full">
      {isLoading ? "Suppression..." : "Retirer de l'équipe"}
    </Button>
  )
}
