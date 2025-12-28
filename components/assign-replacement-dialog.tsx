"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus } from "lucide-react"
import { approveApplication } from "@/app/actions/replacements"
import { toast } from "sonner"
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
} from "@/components/ui/alert-dialog"
import { checkFirefighterAbsence } from "@/app/actions/leaves"

interface AssignReplacementDialogProps {
  replacementId: number
  firefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  replacedFirefighterRole?: string
  shiftFirefighters?: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  shiftId?: number
  shiftDate?: string
}

export function AssignReplacementDialog({
  replacementId,
  firefighters,
  replacedFirefighterRole,
  shiftFirefighters,
  shiftId,
  shiftDate,
}: AssignReplacementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFirefighterId, setSelectedFirefighterId] = useState<string>("")
  const [selectedLieutenantId, setSelectedLieutenantId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState("")
  const [warningHours, setWarningHours] = useState(0)
  const [absenceWarning, setAbsenceWarning] = useState<{
    show: boolean
    firefighterName: string
    absenceDates: string
  } | null>(null)
  const router = useRouter()

  const isReplacingLieutenant = replacedFirefighterRole === "lieutenant"

  const sortedFirefighters = [...firefighters].sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))

  useEffect(() => {
    const checkAbsence = async () => {
      if (!selectedFirefighterId || !shiftDate) return

      const firefighter = firefighters.find((f) => f.id.toString() === selectedFirefighterId)
      if (!firefighter) return

      const absenceCheck = await checkFirefighterAbsence(firefighter.id, shiftDate)

      if (absenceCheck.isAbsent && absenceCheck.absence) {
        const startDate = new Date(absenceCheck.absence.start_date).toLocaleDateString("fr-CA")
        const endDate = new Date(absenceCheck.absence.end_date).toLocaleDateString("fr-CA")

        setAbsenceWarning({
          show: true,
          firefighterName: `${firefighter.first_name} ${firefighter.last_name}`,
          absenceDates: `${startDate} au ${endDate}`,
        })
      } else {
        setAbsenceWarning(null)
      }
    }

    checkAbsence()
  }, [selectedFirefighterId, shiftDate, firefighters])

  const handleAssign = async (force = false) => {
    if (!selectedFirefighterId) {
      toast.error("Veuillez sélectionner un pompier")
      return
    }

    if (isReplacingLieutenant && !selectedLieutenantId) {
      setSelectedLieutenantId(selectedFirefighterId)
    }

    if (absenceWarning?.show && !force) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await approveApplication(replacementId, Number.parseInt(selectedFirefighterId), force)

      if (result.error === "CONSECUTIVE_HOURS_EXCEEDED") {
        setWarningMessage(result.message || "")
        setWarningHours(result.totalHours || 0)
        setShowWarning(true)
        setIsSubmitting(false)
        return
      }

      if (result.success) {
        if (isReplacingLieutenant && shiftId) {
          const { setActingLieutenant } = await import("@/app/actions/shift-assignments")
          const lieutenantId = selectedLieutenantId || selectedFirefighterId
          await setActingLieutenant(shiftId, Number.parseInt(lieutenantId))
        }

        toast.success("Pompier assigné avec succès")
        setIsOpen(false)
        setSelectedFirefighterId("")
        setSelectedLieutenantId("")
        setShowWarning(false)
        setAbsenceWarning(null)
        router.refresh()
      } else {
        toast.error(result.error || "Erreur lors de l'assignation")
      }
    } catch (error) {
      console.error("Error assigning firefighter:", error)
      toast.error("Erreur lors de l'assignation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForceAssign = async () => {
    await handleAssign(true)
  }

  const handleForceAssignDespiteAbsence = async () => {
    setAbsenceWarning(null)
    await handleAssign(false)
  }

  const allShiftFirefighters =
    isReplacingLieutenant && shiftFirefighters && selectedFirefighterId
      ? [
          ...shiftFirefighters.filter((f) => f.role !== "lieutenant"),
          firefighters.find((f) => f.id.toString() === selectedFirefighterId)!,
        ].filter(Boolean)
      : []

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="h-8 text-xs px-2 gap-1 leading-none">
            <UserPlus className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un pompier</DialogTitle>
            <DialogDescription>
              {isReplacingLieutenant
                ? "Sélectionnez un pompier à assigner à ce remplacement de lieutenant"
                : "Sélectionnez un pompier à assigner à ce remplacement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firefighter">Pompier</Label>
              <Select value={selectedFirefighterId} onValueChange={setSelectedFirefighterId}>
                <SelectTrigger id="firefighter">
                  <SelectValue placeholder="Sélectionner un pompier" />
                </SelectTrigger>
                <SelectContent>
                  {sortedFirefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.last_name} {firefighter.first_name} ({firefighter.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isReplacingLieutenant && selectedFirefighterId && allShiftFirefighters.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="lieutenant">Qui sera le lieutenant?</Label>
                <Select value={selectedLieutenantId} onValueChange={setSelectedLieutenantId}>
                  <SelectTrigger id="lieutenant">
                    <SelectValue placeholder="Sélectionner le lieutenant (par défaut: le remplaçant)" />
                  </SelectTrigger>
                  <SelectContent>
                    {allShiftFirefighters
                      .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))
                      .map((firefighter) => (
                        <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                          {firefighter.last_name} {firefighter.first_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si aucun n'est sélectionné, le remplaçant sera le lieutenant
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={() => handleAssign(false)} disabled={isSubmitting || !selectedFirefighterId}>
              {isSubmitting ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={absenceWarning?.show || false} onOpenChange={(open) => !open && setAbsenceWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">⚠️ Attention</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-foreground font-medium">
                {absenceWarning?.firefighterName} est absent du {absenceWarning?.absenceDates}.
              </div>
              <div className="text-sm text-muted-foreground">
                Voulez-vous quand même l'assigner pour ce remplacement?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceAssignDespiteAbsence} className="bg-orange-600 hover:bg-orange-700">
              Assigner quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-600">
              ⚠️ Avertissement: Heures consécutives élevées
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div className="text-foreground font-medium">{warningMessage}</div>
              <div className="text-sm">
                Le pompier sélectionné travaillerait{" "}
                <strong className="text-orange-600">{warningHours}h consécutives</strong>, ce qui dépasse la limite
                recommandée de 38 heures.
              </div>
              <div className="text-sm text-muted-foreground">Voulez-vous quand même assigner ce pompier?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceAssign}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Assignation..." : "Assigner quand même"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
