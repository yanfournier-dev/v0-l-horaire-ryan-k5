"use client"

import type React from "react"
import { availableRoles } from "@/lib/role-labels"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addFirefighter } from "@/app/actions/users"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"

interface Team {
  id: number
  name: string
  type: string
  color: string
}

interface AddFirefighterDialogProps {
  teams: Team[]
}

export function AddFirefighterDialog({ teams }: AddFirefighterDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "firefighter",
    teamId: "0", // Updated default value to be a non-empty string
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const result = await addFirefighter({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || null,
      role: formData.role,
      teamId: formData.teamId ? Number.parseInt(formData.teamId) : null,
    })

    setIsLoading(false)

    if (result.success) {
      setOpen(false)
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "firefighter",
        teamId: "0", // Reset to default non-empty string
      })
      router.refresh()
    } else {
      setError(result.message || "Une erreur est survenue")
    }
  }

  const generateEmail = () => {
    if (formData.firstName && formData.lastName) {
      const email = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase().replace(/[^a-z]/g, "")}@victoriaville.ca`
      setFormData({ ...formData, email })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Ajouter un pompier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau pompier</DialogTitle>
          <DialogDescription>Remplissez les informations du nouveau pompier</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                onBlur={generateEmail}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                onBlur={generateEmail}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="prenom.nom@victoriaville.ca"
              required
            />
            <p className="text-xs text-muted-foreground">L'email sera généré automatiquement si vous laissez vide</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="514-555-0123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle *</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger id="role">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Équipe (optionnel)</Label>
            <Select value={formData.teamId} onValueChange={(value) => setFormData({ ...formData, teamId: value })}>
              <SelectTrigger id="team">
                <SelectValue placeholder="Aucune équipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Aucune équipe</SelectItem> {/* Updated value to be a non-empty string */}
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-semibold mb-1">Mot de passe par défaut:</p>
            <p className="font-mono">Pompier2025!</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
