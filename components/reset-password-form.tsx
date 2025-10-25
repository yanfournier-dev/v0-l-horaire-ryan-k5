"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { resetUserPassword, resetYanPassword } from "@/app/actions/reset-password"
import { useToast } from "@/hooks/use-toast"

export function ResetPasswordForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await resetUserPassword(email, password)

      if (result.success) {
        toast({
          title: "Succès",
          description: `Mot de passe réinitialisé pour ${result.user.first_name} ${result.user.last_name}`,
        })
        setEmail("")
        setPassword("")
      } else {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetYan = async () => {
    setIsLoading(true)

    try {
      const result = await resetYanPassword()

      if (result.success) {
        toast({
          title: "Succès",
          description: `Mot de passe réinitialisé pour Yan Fournier (Pompier2025!)`,
        })
      } else {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Réinitialisation rapide</CardTitle>
          <CardDescription>Réinitialiser le mot de passe de Yan Fournier à "Pompier2025!"</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleResetYan} disabled={isLoading} className="w-full">
            {isLoading ? "Réinitialisation..." : "Réinitialiser Yan Fournier"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réinitialisation personnalisée</CardTitle>
          <CardDescription>Réinitialiser le mot de passe d'un utilisateur spécifique</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="utilisateur@victoriaville.ca"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
