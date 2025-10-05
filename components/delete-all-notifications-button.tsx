"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteAllNotifications } from "@/app/actions/notifications"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"

export function DeleteAllNotificationsButton() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    const result = await deleteAllNotifications()

    if (result.error) {
      console.error("[v0] Error deleting all notifications:", result.error)
    }

    setIsDeleting(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? "Suppression..." : "Tout supprimer"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer toutes les notifications ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Toutes vos notifications seront définitivement supprimées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
            Supprimer tout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
