"use client"

import { useState } from "react"
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
}

export function AssignReplacementDialog({
  replacementId,
  firefighters,
  replacedFirefighterRole,
  shiftFirefighters,
  shiftId,
}: AssignReplacementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFirefighterId, setSelectedFirefighterId] = useState<string>("")
  const [selectedLieutenantId, setSelectedLieutenantId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const isReplacingLieutenant = replacedFirefighterRole === "lieutenant"

  const handleAssign = async () => {
    if (!selectedFirefighterId) {
      toast.error("Veuillez sélectionner un pompier")
      return
    }

    if (isReplacingLieutenant && !selectedLieutenantId) {
      setSelectedLieutenantId(selectedFirefighterId)
    }

    setIsSubmitting(true)

    try {
      // Create a fake application to approve
      const result = await approveApplication(replacementId, Number.parseInt(selectedFirefighterId))

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

  const allShiftFirefighters =
    isReplacingLieutenant && shiftFirefighters && selectedFirefighterId
      ? [
          ...shiftFirefighters.filter((f) => f.role !== "lieutenant"), // Exclude the replaced lieutenant
          firefighters.find((f) => f.id.toString() === selectedFirefighterId)!,
        ].filter(Boolean)
      : []

  return (
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
                {firefighters.map((firefighter) => (
                  <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                    {firefighter.first_name} {firefighter.last_name} ({firefighter.role})
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
                  {allShiftFirefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.first_name} {firefighter.last_name}
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
          <Button onClick={handleAssign} disabled={isSubmitting || !selectedFirefighterId}>
            {isSubmitting ? "Assignation..." : "Assigner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
