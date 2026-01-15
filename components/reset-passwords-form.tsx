"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { resetAllPasswordsToDefault } from "@/app/actions/reset-all-passwords"
import { AlertTriangle, Key, Loader2 } from "lucide-react"

export function ResetPasswordsForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleReset() {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await resetAllPasswordsToDefault()
      setResult(response)
      if (response.success) {
        setShowConfirm(false)
      }
    } catch (error) {
      setResult({ error: "Une erreur inattendue s'est produite" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Mot de passe par défaut: SSIV2026
        </CardTitle>
        <CardDescription>
          Cette action réinitialisera le mot de passe de TOUS les utilisateurs au mot de passe par défaut.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <Alert
            variant={result.error ? "destructive" : "default"}
            className={result.success ? "border-green-500 bg-green-50" : ""}
          >
            <AlertDescription>{result.error || result.message}</AlertDescription>
          </Alert>
        )}

        {!showConfirm ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Attention:</strong> Cette action est irréversible et affectera tous les utilisateurs du système.
                Tous les pompiers pourront se connecter avec le mot de passe <strong>SSIV2026</strong>.
              </AlertDescription>
            </Alert>

            <Button onClick={() => setShowConfirm(true)} variant="destructive" className="w-full">
              Réinitialiser tous les mots de passe
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Êtes-vous absolument certain de vouloir réinitialiser tous les mots de passe ?
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={handleReset} disabled={isLoading} variant="destructive" className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer la réinitialisation
              </Button>
              <Button onClick={() => setShowConfirm(false)} disabled={isLoading} variant="outline" className="flex-1">
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
