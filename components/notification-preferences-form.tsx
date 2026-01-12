"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateUserPreferences } from "@/app/actions/notifications"
import { generateTelegramLink, disconnectTelegram } from "@/app/actions/telegram"
import { Bell, MessageSquare, ExternalLink } from "lucide-react"

interface NotificationPreferencesFormProps {
  userId: number
  initialPreferences: any
}

export function NotificationPreferencesForm({ userId, initialPreferences }: NotificationPreferencesFormProps) {
  const [preferences, setPreferences] = useState({
    enable_app: true,
    enable_email: initialPreferences?.enable_email ?? false,
    enable_telegram: initialPreferences?.enable_telegram ?? false,
    telegram_chat_id: initialPreferences?.telegram_chat_id ?? null,
    notify_replacement_available: initialPreferences?.notify_replacement_available ?? false,
    notify_replacement_accepted: initialPreferences?.notify_replacement_accepted ?? false,
    notify_replacement_rejected: initialPreferences?.notify_replacement_rejected ?? false,
  })

  const [savingToggles, setSavingToggles] = useState<Set<string>>(new Set())
  const [connectingTelegram, setConnectingTelegram] = useState(false)

  const handleToggle = async (key: string, value: boolean) => {
    // Update local state immediately for responsive UI
    const newPreferences = { ...preferences, [key]: value }
    setPreferences(newPreferences)

    // Mark this toggle as saving
    setSavingToggles((prev) => new Set(prev).add(key))

    // Save to database
    await updateUserPreferences(userId, newPreferences)

    // Remove from saving state after a short delay
    setTimeout(() => {
      setSavingToggles((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 500)
  }

  const handleTelegramConnect = async () => {
    setConnectingTelegram(true)
    try {
      const result = await generateTelegramLink()
      if (result.success && result.link) {
        // On iOS, window.open() with _blank can be blocked, use location.href instead
        window.location.href = result.link
      } else {
        console.error("[v0] Failed to generate Telegram link:", result.error)
        alert("Erreur lors de la génération du lien Telegram")
      }
    } catch (error) {
      console.error("[v0] Error connecting Telegram:", error)
      alert("Erreur lors de la connexion à Telegram")
    } finally {
      setConnectingTelegram(false)
    }
  }

  const handleTelegramDisconnect = async () => {
    try {
      const result = await disconnectTelegram()
      if (result.success) {
        const newPreferences = {
          ...preferences,
          telegram_chat_id: null,
          enable_telegram: false,
        }
        setPreferences(newPreferences)
        // Auto-save after disconnect
        await updateUserPreferences(userId, newPreferences)
      }
    } catch (error) {
      console.error("[v0] Error disconnecting Telegram:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Channels */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Canaux de notification</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choisissez comment vous souhaitez recevoir vos notifications
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border border-muted">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Notifications dans l'application</Label>
                <p className="text-sm text-muted-foreground">Toujours activées (obligatoire)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 font-medium">✓ Activé</span>
            </div>
          </div>

          {/* 
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="enable_email" className="font-medium">
                  Notifications par email
                </Label>
                <p className="text-sm text-muted-foreground">Recevez des emails pour les événements importants</p>
              </div>
            </div>
            <Switch
              id="enable_email"
              checked={preferences.enable_email}
              onCheckedChange={(checked) => handleToggle("enable_email", checked)}
              disabled={savingToggles.has("enable_email")}
            />
          </div>
          */}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="enable_telegram" className="font-medium">
                  Notifications par Telegram
                </Label>
                <p className="text-sm text-muted-foreground">
                  {preferences.telegram_chat_id ? (
                    <span className="text-green-600 font-medium">✓ Connecté</span>
                  ) : (
                    "Recevez des notifications instantanées sur Telegram"
                  )}
                </p>
                {!preferences.telegram_chat_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-transparent"
                    onClick={handleTelegramConnect}
                    disabled={connectingTelegram}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connecter Telegram
                  </Button>
                )}
                {preferences.telegram_chat_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-red-600 hover:text-red-700"
                    onClick={handleTelegramDisconnect}
                  >
                    Déconnecter
                  </Button>
                )}
              </div>
            </div>
            <Switch
              id="enable_telegram"
              checked={preferences.enable_telegram}
              onCheckedChange={(checked) => handleToggle("enable_telegram", checked)}
              disabled={!preferences.telegram_chat_id || savingToggles.has("enable_telegram")}
            />
          </div>
        </div>
      </Card>

      {/* Notification Types */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Types de notifications</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choisissez les événements pour lesquels vous souhaitez être notifié
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_replacement_available" className="font-medium">
                Remplacements disponibles
              </Label>
              <p className="text-sm text-muted-foreground">Quand un nouveau remplacement est publié</p>
            </div>
            <Switch
              id="notify_replacement_available"
              checked={preferences.notify_replacement_available}
              onCheckedChange={(checked) => handleToggle("notify_replacement_available", checked)}
              disabled={savingToggles.has("notify_replacement_available")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_replacement_accepted" className="font-medium">
                Remplacement accepté
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre candidature est acceptée</p>
            </div>
            <Switch
              id="notify_replacement_accepted"
              checked={preferences.notify_replacement_accepted}
              onCheckedChange={(checked) => handleToggle("notify_replacement_accepted", checked)}
              disabled={savingToggles.has("notify_replacement_accepted")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_replacement_rejected" className="font-medium">
                Remplacement refusé
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre candidature est refusée</p>
            </div>
            <Switch
              id="notify_replacement_rejected"
              checked={preferences.notify_replacement_rejected}
              onCheckedChange={(checked) => handleToggle("notify_replacement_rejected", checked)}
              disabled={savingToggles.has("notify_replacement_rejected")}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
