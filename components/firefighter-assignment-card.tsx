"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createReplacementFromShift } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getRoleLabel } from "@/lib/role-labels"

interface FirefighterAssignmentCardProps {
  assignment: {
    id: number
    user_id: number
    first_name: string
    last_name: string
    role: string
  }
  shift: {
    id: number
    shift_type: string
    team_id: number
    team_name: string
  }
  shiftDate: string
  index: number
  isAdmin: boolean
}

export function FirefighterAssignmentCard({
  assignment,
  shift,
  shiftDate,
  index,
  isAdmin,
}: FirefighterAssignmentCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const handleCreateReplacement = async () => {
    setIsCreating(true)
    try {
      const result = await createReplacementFromShift(assignment.user_id, shiftDate, shift.shift_type, shift.team_id)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Demande de remplacement créée avec succès")
        setDialogOpen(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Erreur lors de la création de la demande")
    } finally {
      setIsCreating(false)
    }
  }

  const cardContent = (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <span className="text-xs font-medium text-muted-foreground">{index + 1}.</span>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {assignment.first_name} {assignment.last_name}
        </p>
        {assignment.role !== "firefighter" && (
          <Badge variant="outline" className="text-xs mt-1">
            {getRoleLabel(assignment.role)}
          </Badge>
        )}
      </div>
    </div>
  )

  if (!isAdmin) {
    return cardContent
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full text-left hover:opacity-80 transition-opacity cursor-pointer"
      >
        {cardContent}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une demande de remplacement</DialogTitle>
            <DialogDescription>Voulez-vous créer une demande de remplacement pour ce pompier?</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Pompier</div>
              <div className="text-base font-semibold">
                {assignment.first_name} {assignment.last_name}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Date</div>
              <div className="text-base">
                {new Date(shiftDate).toLocaleDateString("fr-CA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Équipe</div>
              <div className="text-base">{shift.team_name}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Type de quart</div>
              <div className="text-base">
                {shift.shift_type === "day" ? "Jour" : shift.shift_type === "night" ? "Nuit" : "24h"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>
              Annuler
            </Button>
            <Button onClick={handleCreateReplacement} disabled={isCreating}>
              {isCreating ? "Création..." : "Créer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
