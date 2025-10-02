"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { applyForReplacement } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"

interface ApplyForReplacementButtonProps {
  replacementId: number
}

export function ApplyForReplacementButton({ replacementId }: ApplyForReplacementButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleApply = async () => {
    setIsLoading(true)
    const result = await applyForReplacement(replacementId)
    setIsLoading(false)

    if (result.success) {
      router.refresh()
    } else if (result.error) {
      alert(result.error)
    }
  }

  return (
    <Button onClick={handleApply} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
      {isLoading ? "Candidature..." : "Postuler"}
    </Button>
  )
}
