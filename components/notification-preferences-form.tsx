"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateUserPreferences } from "@/app/actions/notifications"
import { generateTelegramLink, disconnectTelegram } from "@/app/actions/telegram"
import { Bell, MessageSquare, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface NotificationPreferencesFormProps {
  userId: number
  initialPreferences: any
}

export function NotificationPreferencesForm({ userId, initialPreferences }: NotificationPreferencesFormProps) {
  const [preferences, setPreferences] = useState({
    enable_app: initialPreferences?.enable_app ?? true,
    enable_email: initialPreferences?.enable_email ?? false,
    enable_telegram: initialPreferences?.enable_telegram ?? true,
    telegram_chat_id: initialPreferences?.telegram_chat_id ?? null,
    notify_replacement_available: true,
    notify_replacement_accepted: true,
    notify_replacement_rejected: initialPreferences?.notify_replacement_rejected ?? false,
  })

  const [savingToggles, setSavingToggles] = useState<Set<string>>(new Set())
  const [connectingTelegram, setConnectingTelegram] = useState(false)

  const handleToggle = async (key: string, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value }
    setPreferences(newPreferences)

    setSavingToggles((prev) => new Set(prev).add(key))

    await updateUserPreferences(userId, newPreferences)

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
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3 flex-1">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="enable-app" className="text-base font-medium">
                  Notifications dans l'application
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recevez les notifications dans l'interface de l'application
                </p>
              </div>
            </div>
            <Switch
              id="enable-app"
              checked={preferences.enable_app}
              onCheckedChange={(value) => handleToggle("enable_app", value)}
              disabled={savingToggles.has("enable_app")}
            />
          </div>

          <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3 flex-1">
              <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="text-base font-medium">Notifications par Telegram</Label>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                    Obligatoire
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Telegram est obligatoire pour recevoir les notifications critiques de remplacement
                </p>
                {preferences.telegram_chat_id ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Connecté
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleTelegramDisconnect}>
                      Déconnecter
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleTelegramConnect}
                    disabled={connectingTelegram}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {connectingTelegram ? "Connexion..." : "Connecter Telegram"}
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                )}
              </div>
            </div>
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
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-base font-medium">Remplacements disponibles</Label>
                <Badge variant="outline" className="text-xs">
                  Obligatoire
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Quand un nouveau remplacement est publié</p>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Toujours activé</Badge>
          </div>

          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-base font-medium">Remplacement accepté</Label>
                <Badge variant="outline" className="text-xs">
                  Obligatoire
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Quand votre candidature est acceptée</p>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Toujours activé</Badge>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex-1">
              <Label htmlFor="notify-rejected" className="text-base font-medium">
                Remplacement refusé
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre candidature est refusée</p>
            </div>
            <Switch
              id="notify-rejected"
              checked={preferences.notify_replacement_rejected}
              onCheckedChange={(value) => handleToggle("notify_replacement_rejected", value)}
              disabled={savingToggles.has("notify_replacement_rejected")}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
