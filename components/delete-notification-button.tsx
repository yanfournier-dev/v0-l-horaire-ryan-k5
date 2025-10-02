"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteNotification } from "@/app/actions/notifications"
import { useRouter } from "next/navigation"

interface DeleteNotificationButtonProps {
  notificationId: number
}

export function DeleteNotificationButton({ notificationId }: DeleteNotificationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsLoading(true)
    await deleteNotification(notificationId)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Button onClick={handleDelete} disabled={isLoading} size="sm" variant="ghost">
      {isLoading ? "Suppression..." : "Supprimer"}
    </Button>
  )
}
