"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateUserPreferences } from "@/app/actions/notifications"
import { Bell, Mail, CheckCircle2 } from "lucide-react"

interface NotificationPreferencesFormProps {
  userId: number
  initialPreferences: any
}

export function NotificationPreferencesForm({ userId, initialPreferences }: NotificationPreferencesFormProps) {
  const [preferences, setPreferences] = useState({
    enable_app: initialPreferences?.enable_app ?? true,
    enable_email: initialPreferences?.enable_email ?? false,
    notify_replacement_available: initialPreferences?.notify_replacement_available ?? true,
    notify_replacement_accepted: initialPreferences?.notify_replacement_accepted ?? true,
    notify_replacement_rejected: initialPreferences?.notify_replacement_rejected ?? true,
    notify_leave_approved: initialPreferences?.notify_leave_approved ?? true,
    notify_leave_rejected: initialPreferences?.notify_leave_rejected ?? true,
    notify_schedule_change: initialPreferences?.notify_schedule_change ?? true,
    notify_shift_reminder: initialPreferences?.notify_shift_reminder ?? true,
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_leave_approved" className="font-medium">
                Congé approuvé
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre demande de congé est approuvée</p>
            </div>
            <Switch
              id="notify_leave_approved"
              checked={preferences.notify_leave_approved}
              onCheckedChange={(checked) => handleToggle("notify_leave_approved", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_leave_rejected" className="font-medium">
                Congé refusé
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre demande de congé est refusée</p>
            </div>
            <Switch
              id="notify_leave_rejected"
              checked={preferences.notify_leave_rejected}
              onCheckedChange={(checked) => handleToggle("notify_leave_rejected", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_schedule_change" className="font-medium">
                Changements d'horaire
              </Label>
              <p className="text-sm text-muted-foreground">Quand votre horaire est modifié</p>
            </div>
            <Switch
              id="notify_schedule_change"
              checked={preferences.notify_schedule_change}
              onCheckedChange={(checked) => handleToggle("notify_schedule_change", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_shift_reminder" className="font-medium">
                Rappels de quart
              </Label>
              <p className="text-sm text-muted-foreground">Rappel 24h avant votre quart</p>
            </div>
            <Switch
              id="notify_shift_reminder"
              checked={preferences.notify_shift_reminder}
              onCheckedChange={(checked) => handleToggle("notify_shift_reminder", checked)}
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
