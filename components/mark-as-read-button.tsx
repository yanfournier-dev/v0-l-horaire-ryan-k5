"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { markAsRead } from "@/app/actions/notifications"
import { useRouter } from "next/navigation"

interface MarkAsReadButtonProps {
  notificationId: number
}

export function MarkAsReadButton({ notificationId }: MarkAsReadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleMarkAsRead = async () => {
    setIsLoading(true)
    await markAsRead(notificationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleMarkAsRead} disabled={isLoading} size="sm" variant="outline">
      {isLoading ? "Marquage..." : "Marquer comme lu"}
    </Button>
  )
}
