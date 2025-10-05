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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateLeave } from "@/app/actions/leaves"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface EditLeaveButtonProps {
  leaveId: number
  startDate: string
  endDate: string
  leaveType: string
  reason?: string
  startTime?: string
  endTime?: string
}

export function EditLeaveButton({
  leaveId,
  startDate,
  endDate,
  leaveType,
  reason,
  startTime,
  endTime,
}: EditLeaveButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await updateLeave(
      leaveId,
      formData.get("startDate") as string,
      formData.get("endDate") as string,
      formData.get("leaveType") as string,
      formData.get("reason") as string,
      formData.get("startTime") as string,
      formData.get("endTime") as string,
    )

    setIsLoading(false)

    if (result.error) {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Succès",
        description: "La demande a été modifiée avec succès",
      })
      setIsOpen(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier la demande d'absence</DialogTitle>
          <DialogDescription>Modifiez les détails de votre demande d'absence</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Date de fin</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={endDate} required disabled={isLoading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaveType">Type d'absence</Label>
            <Select name="leaveType" required disabled={isLoading} defaultValue={leaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Journée complète</SelectItem>
                <SelectItem value="partial">Partielle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Heure de début (optionnel)</Label>
              <Input id="startTime" name="startTime" type="time" defaultValue={startTime || ""} disabled={isLoading} />
              <p className="text-xs text-muted-foreground">Pour les absences partielles</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Heure de fin (optionnel)</Label>
              <Input id="endTime" name="endTime" type="time" defaultValue={endTime || ""} disabled={isLoading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Expliquez brièvement la raison de votre absence..."
              rows={4}
              defaultValue={reason || ""}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={isLoading}>
              {isLoading ? "Modification..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
