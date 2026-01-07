"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteReplacement, removeReplacementAssignment } from "@/app/actions/replacements"
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

export function DeleteReplacementButton({
  replacementId,
  onSuccess,
  hasAssignedCandidate = false,
  variant,
  size,
  className,
}: {
  replacementId: number
  onSuccess?: () => void
  hasAssignedCandidate?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    console.log("[v0] DeleteReplacementButton - handleDelete called, hasAssignedCandidate:", hasAssignedCandidate)

    if (isDeleting) return

    setIsDeleting(true)
    setIsOpen(false)

    try {
      let result

      if (hasAssignedCandidate) {
        console.log("[v0] DeleteReplacementButton - calling removeReplacementAssignment")
        result = await removeReplacementAssignment(replacementId)
      } else {
        console.log("[v0] DeleteReplacementButton - calling deleteReplacement")
        result = await deleteReplacement(replacementId)
      }

      console.log("[v0] DeleteReplacementButton - result:", JSON.stringify(result))

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
        console.log("[v0] DeleteReplacementButton - success, onSuccess exists:", !!onSuccess)

        if (onSuccess) {
          console.log("[v0] DeleteReplacementButton - calling onSuccess (loadData)")
          await onSuccess()
          console.log("[v0] DeleteReplacementButton - onSuccess completed")
        } else {
          console.log("[v0] DeleteReplacementButton - no onSuccess, calling router.refresh()")
          router.refresh()
        }

        setTimeout(() => {
          setIsDeleting(false)
        }, 500)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[v0] DeleteReplacementButton - error:", errorMessage)
      alert(`Erreur: ${errorMessage}`)
      setIsDeleting(false)
    }
  }

  const dialogTitle = hasAssignedCandidate ? "Retirer l'assignation" : "Confirmer la suppression"
  const dialogDescription = hasAssignedCandidate
    ? "Êtes-vous sûr de vouloir retirer ce pompier de ce remplacement? Le remplacement restera disponible et toutes les candidatures seront conservées."
    : "Êtes-vous sûr de vouloir supprimer ce remplacement? Cette action est irréversible et supprimera également toutes les candidatures associées."
  const actionButtonText = hasAssignedCandidate
    ? isDeleting
      ? "Retrait..."
      : "Retirer"
    : isDeleting
      ? "Suppression..."
      : "Supprimer"

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !isDeleting && setIsOpen(open)}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant || "destructive"}
          size={size || "sm"}
          disabled={isDeleting}
          className={className || "h-8 text-xs px-2 gap-1 leading-none"}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {actionButtonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
