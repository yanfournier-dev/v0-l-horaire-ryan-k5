"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { applyForReplacement } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"

interface AddManualApplicationDialogProps {
  replacementId: number
  availableFirefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
    email: string
    team_name?: string
  }>
  existingApplicantIds: number[]
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function AddManualApplicationDialog({
  replacementId,
  availableFirefighters,
  existingApplicantIds,
  trigger,
  onSuccess,
}: AddManualApplicationDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const eligibleFirefighters = (availableFirefighters || [])
    .filter((ff) => !existingApplicantIds.includes(ff.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))

  const handleApplyForMe = async () => {
    setIsSubmitting(true)
    try {
      // Get current user and apply with their ID
      const result = await applyForReplacement(replacementId, null)

      if (result.error) {
        alert(result.error)
      } else {
        setOpen(false)
        router.refresh()
        onSuccess?.()
      }
    } catch (error) {
      console.error("[v0] Error applying for myself:", error)
      alert("Erreur lors de l'ajout de votre candidature")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddCandidate = async () => {
    if (!selectedFirefighter) return

    setIsSubmitting(true)
    try {
      const result = await applyForReplacement(replacementId, Number.parseInt(selectedFirefighter))

      if (result.error) {
        alert(result.error)
      } else {
        setOpen(false)
        setSelectedFirefighter("")
        router.refresh()
        onSuccess?.()
      }
    } catch (error) {
      console.error("[v0] Error adding manual application:", error)
      alert("Erreur lors de l'ajout de la candidature")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une candidature
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une candidature</DialogTitle>
          <DialogDescription>
            Sélectionnez un pompier pour ajouter une candidature à ce remplacement, ou ajoutez votre propre candidature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {eligibleFirefighters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Tous les pompiers disponibles ont déjà postulé pour ce remplacement
            </p>
          ) : (
            <Select value={selectedFirefighter} onValueChange={setSelectedFirefighter}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un pompier" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {eligibleFirefighters.map((firefighter) => (
                  <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                    {firefighter.last_name} {firefighter.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleApplyForMe}
            disabled={isSubmitting}
            className="w-full bg-transparent"
          >
            Postuler pour moi
          </Button>
          <Button onClick={handleAddCandidate} disabled={!selectedFirefighter || isSubmitting} className="w-full">
            Ajouter candidature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
