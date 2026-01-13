"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { unassignReplacement } from "@/app/actions/unassign-replacement"
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
import { XCircle } from "lucide-react"

interface UnassignReplacementButtonProps {
  applicationId: number
  firefighterName: string
}

export function UnassignReplacementButton({ applicationId, firefighterName }: UnassignReplacementButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleUnassign = async () => {
    setIsLoading(true)

    try {
      const result = await unassignReplacement(applicationId)
      if (result.success) {
        window.location.href = window.location.pathname + "?t=" + Date.now()
      } else {
        alert(result.error || "Erreur lors de l'annulation")
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Erreur lors de l'annulation")
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-orange-600 border-orange-600 hover:bg-orange-50 bg-transparent"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Annuler l'assignation
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler l'assignation?</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir annuler l'assignation de <strong>{firefighterName}</strong>? Tous les candidats
            redeviendront disponibles pour ce remplacement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnassign}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? "Annulation..." : "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
