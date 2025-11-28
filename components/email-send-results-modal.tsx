"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export interface EmailResult {
  success: boolean
  sent: Array<{
    name: string
    email: string
  }>
  failed: Array<{
    name: string
    email: string
    error: string
  }>
}

interface EmailSendResultsModalProps {
  isOpen: boolean
  onClose: () => void
  results: EmailResult | null
  onRetry?: () => Promise<void>
}

export function EmailSendResultsModal({ isOpen, onClose, results, onRetry }: EmailSendResultsModalProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const router = useRouter()

  if (!results) return null

  const totalSent = results.sent.length
  const totalFailed = results.failed.length
  const allSuccess = totalFailed === 0 && totalSent > 0

  const handleRetry = async () => {
    if (!onRetry) return
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleViewDetails = () => {
    onClose()
    router.push("/dashboard/notifications")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allSuccess ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Notifications envoyées avec succès
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Certaines notifications n'ont pas pu être envoyées
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {allSuccess
              ? `${totalSent} pompier${totalSent > 1 ? "s ont" : " a"} reçu la notification par email.`
              : `${totalSent} envoyé${totalSent > 1 ? "s" : ""} avec succès, ${totalFailed} échec${totalFailed > 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {totalSent > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Envoyés avec succès ({totalSent})
              </h4>
              <div className="space-y-1 pl-6">
                {results.sent.map((recipient, index) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    • {recipient.name}
                    <span className="text-xs ml-2 text-muted-foreground/70">({recipient.email})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalFailed > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Échecs d'envoi ({totalFailed})
              </h4>
              <div className="space-y-2 pl-6">
                {results.failed.map((recipient, index) => (
                  <div key={index} className="text-sm">
                    <div className="font-medium text-foreground">
                      • {recipient.name}
                      <span className="text-xs ml-2 text-muted-foreground">({recipient.email})</span>
                    </div>
                    <div className="text-xs text-red-600 mt-1 ml-4">Raison: {recipient.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {totalFailed > 0 && onRetry && (
            <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? "Réessai en cours..." : "Réessayer"}
            </Button>
          )}
          {totalFailed > 0 && (
            <Button variant="outline" onClick={handleViewDetails}>
              Voir les détails
            </Button>
          )}
          <Button onClick={onClose}>{totalFailed > 0 ? "Fermer" : "OK"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
