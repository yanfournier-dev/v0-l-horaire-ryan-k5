"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react"
import { setupTelegramWebhook, getTelegramWebhookInfo } from "@/app/actions/telegram"

export function TelegramWebhookSetup() {
  const [loading, setLoading] = useState(false)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<any>(null)

  async function handleSetup() {
    setLoading(true)
    setResult(null)

    try {
      const response = await setupTelegramWebhook()

      if (response.success) {
        setResult({
          success: true,
          message: response.message,
        })
      } else {
        setResult({
          success: false,
          error: response.error,
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckInfo() {
    setLoadingInfo(true)
    setWebhookInfo(null)

    try {
      const response = await getTelegramWebhookInfo()

      if (response.success) {
        setWebhookInfo(response.webhookInfo)
      } else {
        setWebhookInfo({ error: response.error })
      }
    } catch (error) {
      setWebhookInfo({ error: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}` })
    } finally {
      setLoadingInfo(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Cliquez sur le bouton ci-dessous pour configurer le webhook Telegram. Cette action enregistre l'URL de votre
          application auprès de Telegram pour recevoir les notifications de boutons.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Cette configuration doit être effectuée une seule fois lors de la mise en service.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSetup} disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Configuration en cours..." : "Configurer le webhook Telegram"}
        </Button>

        <Button
          onClick={handleCheckInfo}
          disabled={loadingInfo}
          variant="outline"
          title="Vérifier le statut du webhook"
        >
          {loadingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
        </Button>
      </div>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 mt-0.5" />
            )}
            <AlertDescription className="whitespace-pre-wrap">
              {result.success ? result.message : result.error}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {webhookInfo && (
        <Alert variant={webhookInfo.error ? "destructive" : "default"}>
          <div className="space-y-2">
            <p className="font-semibold">Statut du Webhook Telegram</p>
            {webhookInfo.error ? (
              <p className="text-sm">{webhookInfo.error}</p>
            ) : (
              <div className="text-sm space-y-1">
                <p>
                  <strong>URL:</strong> {webhookInfo.url}
                </p>
                <p>
                  <strong>Messages en attente:</strong> {webhookInfo.pendingUpdateCount}
                </p>
                {webhookInfo.lastErrorDate && (
                  <p className="text-red-600">
                    <strong>Dernière erreur:</strong> {webhookInfo.lastErrorDate}
                    <br />
                    <strong>Message:</strong> {webhookInfo.lastErrorMessage}
                  </p>
                )}
                {!webhookInfo.lastErrorDate && (
                  <p className="text-green-600">
                    <strong>Aucune erreur récente</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </Alert>
      )}
    </div>
  )
}
