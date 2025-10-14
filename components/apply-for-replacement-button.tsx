"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { applyForReplacement } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ApplyForReplacementButtonProps {
  replacementId: number
  isAdmin?: boolean
  firefighters?: any[]
}

export function ApplyForReplacementButton({
  replacementId,
  isAdmin = false,
  firefighters = [],
}: ApplyForReplacementButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<string>("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleApply = async (firefighterId?: number) => {
    setIsLoading(true)

    const result = await applyForReplacement(replacementId, firefighterId)
    setIsLoading(false)

    if (result.success) {
      toast({
        title: "Candidature envoyée",
        description: firefighterId
          ? "La candidature a été envoyée avec succès."
          : "Votre candidature a été envoyée avec succès.",
      })

      setIsDialogOpen(false)
      setSelectedFirefighter("")
      router.refresh()
    } else if (result.error) {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  if (isAdmin) {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={isLoading}>
            Postuler
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Postuler pour ce remplacement</DialogTitle>
            <DialogDescription>
              Sélectionnez un pompier pour postuler à ce remplacement, ou postulez pour vous-même.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedFirefighter} onValueChange={setSelectedFirefighter}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un pompier" />
              </SelectTrigger>
              <SelectContent>
                {firefighters.map((firefighter) => (
                  <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                    {firefighter.first_name} {firefighter.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={() => handleApply()} disabled={isLoading} variant="outline" className="flex-1">
                Postuler pour moi
              </Button>
              <Button
                onClick={() => handleApply(Number.parseInt(selectedFirefighter))}
                disabled={isLoading || !selectedFirefighter}
                className="flex-1"
              >
                Postuler pour le pompier sélectionné
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button disabled={isLoading} size="sm">
          {isLoading ? "En cours..." : "Postuler"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Postuler pour ce remplacement</DialogTitle>
          <DialogDescription>Confirmez votre candidature pour ce remplacement.</DialogDescription>
        </DialogHeader>
        <Button onClick={() => handleApply()} disabled={isLoading} className="w-full">
          {isLoading ? "En cours..." : "Confirmer ma candidature"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
