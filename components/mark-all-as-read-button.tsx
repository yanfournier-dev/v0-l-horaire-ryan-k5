"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { markAllAsRead } from "@/app/actions/notifications"
import { useRouter } from "next/navigation"

export function MarkAllAsReadButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleMarkAllAsRead = async () => {
    setIsLoading(true)
    await markAllAsRead()
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleMarkAllAsRead} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
      {isLoading ? "Marquage..." : "Tout marquer comme lu"}
    </Button>
  )
}
