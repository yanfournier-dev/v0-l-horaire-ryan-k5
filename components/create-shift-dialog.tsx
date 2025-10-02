"use client"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createShift } from "@/app/actions/calendar"
import { useRouter } from "next/navigation"

interface CreateShiftDialogProps {
  teams: any[]
}

export function CreateShiftDialog({ teams }: CreateShiftDialogProps) {
  const [open, setOpen] = useState(false)
  const [teamId, setTeamId] = useState("")
  const [cycleDay, setCycleDay] = useState("")
  const [shiftType, setShiftType] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!teamId || !cycleDay || !shiftType) return

    setIsLoading(true)

    // Set default times based on shift type
    let startTime = "07:00"
    let endTime = "17:00"

    if (shiftType === "night") {
      startTime = "17:00"
      endTime = "07:00"
    } else if (shiftType === "full_24h") {
      startTime = "07:00"
      endTime = "07:00"
    }

    const result = await createShift(Number.parseInt(teamId), Number.parseInt(cycleDay), shiftType, startTime, endTime)
    setIsLoading(false)

    if (result.success) {
      setOpen(false)
      setTeamId("")
      setCycleDay("")
      setShiftType("")
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700">+ Ajouter un quart</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un quart de travail</DialogTitle>
          <DialogDescription>Configurez un quart pour une équipe et un jour du cycle</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team">Équipe</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team: any) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycleDay">Jour du cycle (1-28)</Label>
            <Input
              id="cycleDay"
              type="number"
              min="1"
              max="28"
              value={cycleDay}
              onChange={(e) => setCycleDay(e.target.value)}
              placeholder="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shiftType">Type de quart</Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Jour (7h-17h)</SelectItem>
                <SelectItem value="night">Nuit (17h-7h)</SelectItem>
                <SelectItem value="full_24h">24 heures (7h-7h)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!teamId || !cycleDay || !shiftType || isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Création..." : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
