import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getNotificationDetail } from "@/app/actions/get-notification-history"

const typeLabels: Record<string, string> = {
  manual_message: "📢 Message manuel",
  replacement_available: "🔄 Remplacement disponible",
  replacement_accepted: "✅ Remplacement accepté",
  replacement_rejected: "❌ Remplacement rejeté",
  replacement_cancelled: "🚫 Remplacement annulé",
  assignment_notification: "📋 Affectation de remplacement",
}

const statusLabels: Record<string, { label: string; color: string }> = {
  success: { label: "Succès", color: "bg-green-100 text-green-800" },
  partial: { label: "Partiel", color: "bg-yellow-100 text-yellow-800" },
  skipped: { label: "Ignoré", color: "bg-gray-100 text-gray-800" },
  failed: { label: "Échec", color: "bg-red-100 text-red-800" },
}

export default async function NotificationDetailPage({ params }: { params: { id: string } }) {
  const notificationId = Number.parseInt(params.id)

  if (Number.isNaN(notificationId)) {
    notFound()
  }

  const result = await getNotificationDetail(notificationId)

  if (!result.success || !result.notification) {
    notFound()
  }

  const notification = result.notification

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/notification-history">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l'historique
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Détails de la notification</CardTitle>
            {notification.delivery_status && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${statusLabels[notification.delivery_status]?.color || ""}`}
              >
                {statusLabels[notification.delivery_status]?.label || notification.delivery_status}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Type et date */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Type de notification</p>
              <p className="mt-1 text-lg font-medium">{typeLabels[notification.type] || `📬 ${notification.type}`}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'envoi</p>
              <p className="mt-1 text-lg font-medium">{formatDate(notification.created_at)}</p>
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-sm text-muted-foreground">Titre</p>
            <p className="mt-1 text-lg font-medium">{notification.title}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Message</p>
            <div className="mt-2 rounded-md bg-muted/50 p-4">
              <p className="whitespace-pre-wrap">{notification.message}</p>
            </div>
          </div>

          {/* Destinataire et expéditeur */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Destinataire</p>
              <p className="mt-1 text-lg font-medium">{notification.user_name}</p>
            </div>
            {notification.sent_by_name && (
              <div>
                <p className="text-sm text-muted-foreground">Envoyé par</p>
                <p className="mt-1 text-lg font-medium">{notification.sent_by_name}</p>
              </div>
            )}
          </div>

          {/* Détails de livraison */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Détails de livraison</h3>

            {notification.channels_sent && notification.channels_sent.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Canaux envoyés avec succès</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {notification.channels_sent.map((channel) => (
                    <span
                      key={channel}
                      className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                    >
                      ✓ {channel === "in_app" ? "App" : channel === "telegram" ? "Telegram" : channel}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {notification.channels_failed && notification.channels_failed.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Canaux échoués</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {notification.channels_failed.map((channel) => (
                    <span
                      key={channel}
                      className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                    >
                      ✗ {channel === "in_app" ? "App" : channel === "telegram" ? "Telegram" : channel}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {notification.error_message && (
              <div>
                <p className="text-sm text-muted-foreground">Message d'erreur</p>
                <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">{notification.error_message}</div>
              </div>
            )}
          </div>

          {/* Informations supplémentaires */}
          {(notification.related_id || notification.related_type) && (
            <div className="space-y-2 rounded-md border p-4">
              <h3 className="font-semibold">Informations liées</h3>
              <div className="grid gap-2 text-sm">
                {notification.related_type && (
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="font-medium">{notification.related_type}</span>
                  </div>
                )}
                {notification.related_id && (
                  <div>
                    <span className="text-muted-foreground">ID:</span>{" "}
                    <span className="font-medium">{notification.related_id}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
