"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Loader2 } from "lucide-react"
import { retryTelegramNotifications } from "@/app/actions/notifications"
import { toast } from "sonner"

interface TelegramError {
  userId: number
  userName: string
  error: string
  notificationId: number | null
}

interface TelegramErrorsDialogProps {
  errors: TelegramError[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TelegramErrorsDialog({ errors, isOpen, onOpenChange }: TelegramErrorsDialogProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryResults, setRetryResults] = useState<Array<{ notificationId: number; success: boolean; error?: string }> | null>(null)

  const handleRetry = async () => {
    if (errors.length === 0 || !errors[0].notificationId) return

    setIsRetrying(true)
    try {
      const notificationIds = errors
        .filter((e) => e.notificationId)
        .map((e) => e.notificationId as number)

      const result = await retryTelegramNotifications(notificationIds)
      setRetryResults(result.results)

      // Show summary toast
      const successful = result.results.filter((r) => r.success).length
      const failed = result.results.filter((r) => !r.success).length

      if (failed === 0) {
        toast.success(`Telegram envoyé avec succès pour ${successful} utilisateur(s)!`)
        setTimeout(() => {
          onOpenChange(false)
          setRetryResults(null)
        }, 1500)
      } else {
        toast.error(`${successful} réussi(s), ${failed} échoué(s)`)
      }
    } catch (error) {
      toast.error("Erreur lors du renvoi des notifications")
      console.error("Retry failed:", error)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Erreurs d'envoi Telegram
          </DialogTitle>
          <DialogDescription>
            {retryResults ? (
              "Résultats du renvoi"
            ) : (
              `${errors.length} utilisateur(s) n'ont pas reçu la notification Telegram`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto space-y-3">
          {!retryResults ? (
            // Initial error list
            errors.map((error) => (
              <Alert key={`${error.userId}-${error.notificationId}`} className="border-destructive/50 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  <div className="font-semibold">{error.userName}</div>
                  <div className="text-xs text-muted-foreground mt-1">{error.error}</div>
                </AlertDescription>
              </Alert>
            ))
          ) : (
            // Retry results
            retryResults.map((result) => {
              const originalError = errors.find((e) => e.notificationId === result.notificationId)
              return (
                <Alert
                  key={result.notificationId}
                  className={result.success ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="font-semibold flex items-center gap-2">
                      {originalError?.userName}
                      {result.success ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Succès</span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">✗ Échoué</span>
                      )}
                    </div>
                    {!result.success && <div className="text-xs text-muted-foreground mt-1">{result.error}</div>}
                  </AlertDescription>
                </Alert>
              )
            })
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRetrying}>
            {retryResults && retryResults.every((r) => r.success) ? "Fermer" : "Annuler"}
          </Button>
          {!retryResults && (
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renvoyer par Telegram
            </Button>
          )}
          {retryResults && !retryResults.every((r) => r.success) && (
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Réessayer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
