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
}

export function AssignReplacementDialog({ replacementId, firefighters }: AssignReplacementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFirefighterId, setSelectedFirefighterId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleAssign = async () => {
    if (!selectedFirefighterId) {
      toast.error("Veuillez sélectionner un pompier")
      return
    }

    setIsSubmitting(true)

    try {
      // Create a fake application to approve
      const result = await approveApplication(replacementId, Number.parseInt(selectedFirefighterId))

      if (result.success) {
        toast.success("Pompier assigné avec succès")
        setIsOpen(false)
        setSelectedFirefighterId("")
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="h-6 text-xs px-2 gap-1 leading-none">
          <UserPlus className="h-3 w-3" />
          Assigner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assigner un pompier</DialogTitle>
          <DialogDescription>Sélectionnez un pompier à assigner à ce remplacement</DialogDescription>
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
