"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { applyForReplacement } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface ApplyForReplacementButtonProps {
  replacementId: number
  cardId: string
  isAdmin?: boolean
  firefighters?: any[]
}

export function ApplyForReplacementButton({
  replacementId,
  cardId,
  isAdmin = false,
  firefighters = [],
}: ApplyForReplacementButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()

  const handleApply = async () => {
    if (isAdmin && !selectedFirefighter) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un pompier",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    const scrollPosition = window.scrollY

    const result = await applyForReplacement(
      replacementId,
      isAdmin && selectedFirefighter ? Number.parseInt(selectedFirefighter) : undefined,
    )
    setIsLoading(false)

    if (result.success) {
      toast({
        title: "Candidature envoyée",
        description: isAdmin
          ? "La candidature a été envoyée avec succès."
          : "Votre candidature a été envoyée avec succès.",
      })

      if (isAdmin) {
        setSelectedFirefighter("")
      }

      router.refresh()

      setTimeout(() => {
        window.scrollTo({ top: scrollPosition, behavior: "instant" })
      }, 500)
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
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="firefighter-select">Sélectionner un pompier</Label>
          <Select value={selectedFirefighter} onValueChange={setSelectedFirefighter}>
            <SelectTrigger id="firefighter-select">
              <SelectValue placeholder="Choisir un pompier..." />
            </SelectTrigger>
            <SelectContent>
              {firefighters.map((firefighter) => (
                <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                  {firefighter.first_name} {firefighter.last_name}
                  {firefighter.team_name && ` (${firefighter.team_name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleApply}
          disabled={isLoading || !selectedFirefighter}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          {isLoading ? "Candidature..." : "Postuler pour ce pompier"}
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleApply} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
      {isLoading ? "Candidature..." : "Postuler"}
    </Button>
  )
}
