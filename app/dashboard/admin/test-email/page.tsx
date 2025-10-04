"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { testEmailAction } from "@/app/actions/test-email"

export default function TestEmailPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTestEmail = async () => {
    if (!email) {
      setResult({ success: false, message: "Veuillez entrer une adresse email" })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await testEmailAction(email)
      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        message: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Test d'envoi d'email</CardTitle>
          <CardDescription>Testez le système d'envoi d'emails avec Resend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email de test</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button onClick={handleTestEmail} disabled={loading} className="w-full">
            {loading ? "Envoi en cours..." : "Envoyer un email de test"}
          </Button>

          {result && (
            <div
              className={`p-4 rounded-lg ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
            >
              <p className="font-medium">{result.success ? "Succès!" : "Erreur"}</p>
              <p className="text-sm mt-1">{result.message}</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Cette page est réservée aux administrateurs pour tester le système d'envoi
              d'emails. Vérifiez les logs de débogage pour plus de détails sur l'envoi.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
