"use client"

import { Button } from "@/components/ui/button"
import { createReplacementFromShift } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { useToast } from "@/hooks/use-toast"

interface CreateReplacementButtonProps {
  userId: number
  userName: string
  shiftDate: string
  shiftType: string
  teamId: number
}

export function CreateReplacementButton({
  userId,
  userName,
  shiftDate,
  shiftType,
  teamId,
}: CreateReplacementButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    setIsLoading(true)
    console.log("[v0] Creating replacement for:", { userId, shiftDate, shiftType, teamId })

    const result = await createReplacementFromShift(userId, shiftDate, shiftType, teamId)

    if (result.error) {
      console.log("[v0] Error creating replacement:", result.error)
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      })
    } else {
      console.log("[v0] Replacement created successfully")
      toast({
        title: "Succès",
        description: "Demande de remplacement créée avec succès",
      })
      router.push("/dashboard/replacements")
    }
    setIsLoading(false)
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-red-600 hover:bg-red-700 text-white border-red-600">
          Créer remplacement
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créer une demande de remplacement</AlertDialogTitle>
          <AlertDialogDescription>
            Voulez-vous créer une demande de remplacement pour <strong>{userName}</strong> le{" "}
            <strong>{new Date(shiftDate).toLocaleDateString("fr-CA")}</strong> ?
            <br />
            <br />
            Les autres pompiers pourront postuler pour ce remplacement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            {isLoading ? "Création..." : "Créer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
