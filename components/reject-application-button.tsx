"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { rejectApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"

interface RejectApplicationButtonProps {
  applicationId: number
}

export function RejectApplicationButton({ applicationId }: RejectApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    if (!confirm("Êtes-vous sûr de vouloir rejeter cette candidature?")) {
      return
    }

    setIsLoading(true)
    await rejectApplication(applicationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleReject} disabled={isLoading} size="sm" variant="destructive" className="flex-1">
      {isLoading ? "Rejet..." : "Rejeter"}
    </Button>
  )
}
