"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"

export default function ResetAdminPasswordPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleReset = async () => {
    setStatus("loading")
    setMessage("")

    try {
      const response = await fetch("/api/reset-admin-password", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setStatus("success")
        setMessage(data.message)
      } else {
        setStatus("error")
        setMessage(data.error || "Une erreur est survenue")
      }
    } catch (error) {
      setStatus("error")
      setMessage("Erreur de connexion au serveur")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Réinitialisation du mot de passe admin</CardTitle>
          <CardDescription>Réinitialiser le mot de passe de Yan Fournier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "idle" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette page permet de réinitialiser le mot de passe de Yan Fournier suite au changement du système de
                hashing.
              </p>
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <p>
                  <strong>Email:</strong> yan.fournier@victoriaville.ca
                </p>
                <p>
                  <strong>Nouveau mot de passe:</strong> Pompier2025!
                </p>
              </div>
              <Button onClick={handleReset} className="w-full">
                Réinitialiser le mot de passe
              </Button>
            </div>
          )}

          {status === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Réinitialisation en cours...</p>
            </div>
          )}

          {status === "success" && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {message}
                <div className="mt-4 space-y-2">
                  <p className="font-medium">Vous pouvez maintenant vous connecter avec:</p>
                  <div className="bg-white p-3 rounded border border-green-200 space-y-1 text-sm">
                    <p>
                      <strong>Email:</strong> yan.fournier@victoriaville.ca
                    </p>
                    <p>
                      <strong>Mot de passe:</strong> Pompier2025!
                    </p>
                  </div>
                  <Button asChild className="w-full mt-4">
                    <a href="/login">Aller à la page de connexion</a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {message}
                <Button onClick={() => setStatus("idle")} variant="outline" className="w-full mt-4">
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
