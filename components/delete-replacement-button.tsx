"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteReplacement } from "@/app/actions/replacements"
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

export function DeleteReplacementButton({ replacementId }: { replacementId: number }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    setIsOpen(false)

    try {
      const result = await deleteReplacement(replacementId)

      if (result.error) {
        if (result.isRateLimit) {
          alert("Trop de requêtes. Veuillez attendre 5 secondes avant de supprimer un autre remplacement.")
          setTimeout(() => {
            setIsDeleting(false)
          }, 5000)
          return
        }
        alert(result.error)
        setIsDeleting(false)
      } else {
        router.refresh()
        setTimeout(() => {
          setIsDeleting(false)
        }, 2000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes("Too Many")) {
        alert("Trop de requêtes. Veuillez attendre 5 secondes avant de supprimer un autre remplacement.")
        setTimeout(() => {
          setIsDeleting(false)
        }, 5000)
      } else {
        alert("Une erreur est survenue lors de la suppression")
        setIsDeleting(false)
      }
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !isDeleting && setIsOpen(open)}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isDeleting} className="h-6 text-xs px-2 gap-1 leading-none">
          <Trash2 className="h-3 w-3" />
          {isDeleting ? "Suppression..." : "Supprimer la demande"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir supprimer ce remplacement? Cette action est irréversible et supprimera également
            toutes les candidatures associées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
