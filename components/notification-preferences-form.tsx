"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateUserPreferences } from "@/app/actions/notifications"
import { Bell, Mail, CheckCircle2, MessageSquare, ExternalLink } from "lucide-react"

interface NotificationPreferencesFormProps {
  userId: number
  initialPreferences: any
}

export function NotificationPreferencesForm({ userId, initialPreferences }: NotificationPreferencesFormProps) {
  const [preferences, setPreferences] = useState({
    enable_app: initialPreferences?.enable_app ?? true,
    enable_email: initialPreferences?.enable_email ?? false,
    enable_telegram: initialPreferences?.enable_telegram ?? false,
    telegram_chat_id: initialPreferences?.telegram_chat_id ?? null,
    notify_replacement_available: initialPreferences?.notify_replacement_available ?? false,
    notify_replacement_accepted: initialPreferences?.notify_replacement_accepted ?? false,
    notify_replacement_rejected: initialPreferences?.notify_replacement_rejected ?? false,
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [connectingTelegram, setConnectingTelegram] = useState(false)

  const handleToggle = (key: string, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await updateUserPreferences(userId, preferences)
    setSaving(false)

    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleTelegramConnect = async () => {
    setConnectingTelegram(true)
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "horaire_ssiv_bot"
    const deepLink = `https://t.me/${botUsername}?start=link_${userId}_${Date.now()}`
    window.open(deepLink, "_blank")
    setConnectingTelegram(false)
  }

  const handleTelegramDisconnect = async () => {
    setPreferences((prev) => ({
      ...prev,
      telegram_chat_id: null,
      enable_telegram: false,
    }))
    setSaved(false)
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="enable_app" className="font-medium">
                  Notifications dans l'application
                </Label>
                <p className="text-sm text-muted-foreground">Recevez des notifications dans l'application</p>
              </div>
            </div>
            <Switch
              id="enable_app"
              checked={preferences.enable_app}
              onCheckedChange={(checked) => handleToggle("enable_app", checked)}
            />
          </div>

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
            />
          </div>

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
              disabled={!preferences.telegram_chat_id}
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
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Enregistrement..." : "Enregistrer les préférences"}
        </Button>
        {saved && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Préférences enregistrées</span>
          </div>
        )}
      </div>
    </div>
  )
}
