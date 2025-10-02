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
import { updateFirefighterRole } from "@/app/actions/teams"
import { useRouter } from "next/navigation"
import { availableRoles } from "@/lib/role-labels"

interface UpdateRoleDialogProps {
  userId: number
  currentRole: string
}

export function UpdateRoleDialog({ userId, currentRole }: UpdateRoleDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState(currentRole)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    setIsLoading(true)
    const result = await updateFirefighterRole(userId, selectedRole)
    setIsLoading(false)

    if (result.success) {
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
          Modifier rôle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le rôle</DialogTitle>
          <DialogDescription>Sélectionnez le nouveau rôle pour ce pompier</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              {isLoading ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
