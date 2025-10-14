"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmPartialAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  firefighterName: string
  isPartial: boolean
  startTime?: string
  endTime?: string
}

export function ConfirmPartialAssignmentDialog({
  open,
  onOpenChange,
  onConfirm,
  firefighterName,
  isPartial,
  startTime,
  endTime,
}: ConfirmPartialAssignmentDialogProps) {
  const timeInfo = isPartial && startTime && endTime ? ` de ${startTime} à ${endTime}` : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer l'assignation d'un remplacement partiel</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <div>
              Vous êtes sur le point d'assigner <span className="font-semibold">{firefighterName}</span> à un
              remplacement <span className="font-semibold text-orange-600">partiel{timeInfo}</span>.
            </div>
            <div className="text-orange-600 font-medium">
              ⚠️ Attention: Ce remplacement n'est pas complet. Assurez-vous que le pompier est bien disponible pour cette
              période spécifique.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-orange-600 hover:bg-orange-700">
            Confirmer l'assignation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
