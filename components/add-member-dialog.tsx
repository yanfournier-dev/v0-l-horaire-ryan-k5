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
import { addMemberToTeam } from "@/app/actions/teams"
import { useRouter } from "next/navigation"

interface AddMemberDialogProps {
  teamId: number
  availableFirefighters: any[]
}

export function AddMemberDialog({ teamId, availableFirefighters }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const sortedFirefighters = [...availableFirefighters].sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))

  const handleSubmit = async () => {
    if (!selectedUserId) return

    setIsLoading(true)
    const result = await addMemberToTeam(teamId, Number.parseInt(selectedUserId))
    setIsLoading(false)

    if (result.success) {
      setOpen(false)
      setSelectedUserId("")
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700">+ Ajouter un membre</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un membre à l'équipe</DialogTitle>
          <DialogDescription>Sélectionnez un pompier à ajouter à cette équipe</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedUserId || isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
