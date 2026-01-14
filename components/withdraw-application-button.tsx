"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { withdrawApplication } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

interface WithdrawApplicationButtonProps {
  applicationId: number
  shiftDate: string
  shiftType: string
}

export function WithdrawApplicationButton({ applicationId, shiftDate, shiftType }: WithdrawApplicationButtonProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    setIsOpen(false)

    try {
      const result = await withdrawApplication(applicationId)

      if (result.error) {
        alert(result.error)
        if ((result as any).isRateLimit) {
          // Wait 3 seconds before allowing another attempt
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      } else {
        router.refresh()
        // Wait 1 second before re-enabling to prevent accidental double-clicks
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error("[v0] Error withdrawing application:", error)
      alert("Une erreur est survenue lors du retrait de la candidature")
    } finally {
      setIsWithdrawing(false)
    }
  }

  const formattedDate = new Date(shiftDate).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isWithdrawing}
          className="h-6 text-xs px-2 gap-1 leading-none bg-transparent"
        >
          <X className="h-3 w-3" />
          {isWithdrawing ? "Retrait..." : "Retirer"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retirer la candidature</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir retirer votre candidature pour le remplacement du {formattedDate} (
            {shiftType === "day" ? "Jour" : "Nuit"}) ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleWithdraw} className="bg-destructive text-white hover:bg-destructive/90">
            Retirer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
