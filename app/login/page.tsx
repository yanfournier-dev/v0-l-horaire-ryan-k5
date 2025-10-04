"use client"

import { login } from "@/app/actions/auth"
import { setupAdminUser } from "@/app/actions/setup-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useState } from "react"
import { useFormStatus } from "react-dom"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={pending}>
      {pending ? "Connexion..." : "Se connecter"}
    </Button>
  )
}

export default function LoginPage() {
  const [setupMessage, setSetupMessage] = useState("")
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [loginError, setLoginError] = useState("")

  async function setupAdmin() {
    setIsSettingUp(true)
    setSetupMessage("")

    try {
      const result = await setupAdminUser()

      if (result.success) {
        setSetupMessage(
          "✅ " + result.message + " - Vous pouvez maintenant vous connecter avec admin@caserne.ca / admin123",
        )
      } else {
        setSetupMessage("❌ Erreur: " + result.error)
      }
    } catch (error) {
      console.error("[v0] Setup error:", error)
      setSetupMessage(
        "❌ Erreur lors de la configuration: " + (error instanceof Error ? error.message : "Erreur inconnue"),
      )
    } finally {
      setIsSettingUp(false)
    }
  }

  async function handleLogin(formData: FormData) {
    setLoginError("")
    const result = await login(formData)

    if (result?.error) {
      setLoginError(result.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">L'horaire Ryan</CardTitle>
          <CardDescription className="text-center">Connectez-vous à votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          {setupMessage && (
            <Alert className="mb-4">
              <AlertDescription>{setupMessage}</AlertDescription>
            </Alert>
          )}

          {loginError && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{loginError}</AlertDescription>
            </Alert>
          )}

          <form action={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="pompier@caserne.ca" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <SubmitButton />
          </form>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-transparent"
              onClick={setupAdmin}
              disabled={isSettingUp}
            >
              {isSettingUp ? "Configuration..." : "🔧 Configurer l'admin"}
            </Button>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Pas encore de compte?{" "}
            <Link href="/register" className="text-red-600 hover:underline">
              S'inscrire
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
