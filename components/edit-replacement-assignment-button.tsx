"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import { updateReplacementAssignment, getAvailableFirefighters } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface EditReplacementAssignmentButtonProps {
  replacementId: number
  currentFirefighterName?: string
  className?: string
}

export function EditReplacementAssignmentButton({
  replacementId,
  currentFirefighterName,
  className,
}: EditReplacementAssignmentButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<string>("")
  const [firefighters, setFirefighters] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      loadFirefighters()
    }
  }, [isOpen])

  const loadFirefighters = async () => {
    setIsLoading(true)
    const result = await getAvailableFirefighters(replacementId)
    if (Array.isArray(result)) {
      setFirefighters(result.sort((a, b) => a.last_name.localeCompare(b.last_name, "fr")))
    } else {
      alert(result.error || "Erreur lors du chargement des pompiers")
    }
    setIsLoading(false)
  }

  const handleUpdate = async () => {
    if (!selectedFirefighter || isUpdating) return

    setIsUpdating(true)

    try {
      const result = await updateReplacementAssignment(replacementId, Number.parseInt(selectedFirefighter))

      if (result.error) {
        alert(result.error)
        setIsUpdating(false)
      } else {
        setIsOpen(false)
        router.refresh()
        setTimeout(() => {
          setIsUpdating(false)
          setSelectedFirefighter("")
        }, 2000)
      }
    } catch (error) {
      alert("Une erreur est survenue lors de la modification")
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isUpdating && setIsOpen(open)}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          className={`h-8 text-xs px-2 gap-1 leading-none bg-transparent ${className}`}
        >
          <Edit className="h-3 w-3" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'assignation du remplacement</DialogTitle>
          <DialogDescription>
            {currentFirefighterName
              ? `Actuellement assigné à ${currentFirefighterName}. Sélectionnez un nouveau pompier pour ce remplacement.`
              : "Sélectionnez un pompier pour ce remplacement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="firefighter">Pompier</Label>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des pompiers...</p>
            ) : (
              <Select value={selectedFirefighter} onValueChange={setSelectedFirefighter} disabled={isUpdating}>
                <SelectTrigger id="firefighter">
                  <SelectValue placeholder="Sélectionnez un pompier" />
                </SelectTrigger>
                <SelectContent>
                  {firefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.last_name} {firefighter.first_name}
                      {firefighter.team_name && ` - ${firefighter.team_name}`}
                      {firefighter.application_status === "pending" && " (a postulé)"}
                      {firefighter.application_status === "approved" && " (assigné)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUpdating}>
            Annuler
          </Button>
          <Button onClick={handleUpdate} disabled={!selectedFirefighter || isUpdating || isLoading}>
            {isUpdating ? "Modification..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
