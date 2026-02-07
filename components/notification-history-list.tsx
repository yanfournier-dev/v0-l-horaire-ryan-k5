"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getNotificationHistory, type NotificationHistoryItem, acknowledgeNotificationError } from "@/app/actions/get-notification-history"
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"

const typeLabels: Record<string, string> = {
  manual_message: "📢 Message manuel",
  replacement_available: "🔄 Remplacement disponible",
  replacement_accepted: "✅ Remplacement accepté",
  replacement_rejected: "❌ Remplacement rejeté",
  replacement_cancelled: "🚫 Remplacement annulé",
  assignment_notification: "📋 Affectation de remplacement",
}

const statusLabels: Record<string, { label: string; color: string }> = {
  success: { label: "Succès", color: "text-green-600" },
  partial: { label: "Partiel", color: "text-yellow-600" },
  skipped: { label: "Ignoré", color: "text-gray-600" },
  failed: { label: "Échec", color: "text-red-600" },
}

export function NotificationHistoryList() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState({
    type: "all",
    deliveryStatus: "all",
    startDate: "",
    endDate: "",
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
  })

  const fetchHistory = async (page = 1) => {
    setLoading(true)

    const result = await getNotificationHistory({
      ...filters,
      type: filters.type === "all" ? undefined : filters.type,
      deliveryStatus: filters.deliveryStatus === "all" ? undefined : filters.deliveryStatus,
      page,
      limit: 50,
    })

    if (result.success && result.notifications && result.pagination) {
      setNotifications(result.notifications)
      setPagination(result.pagination)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchHistory(1)
  }, [filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handlePageChange = (newPage: number) => {
    fetchHistory(newPage)
  }

  const handleAcknowledgeError = async (notificationId: number) => {
    setAcknowledgingIds((prev) => new Set([...prev, notificationId]))
    
    const result = await acknowledgeNotificationError(notificationId)
    
    if (result.success) {
      // Force a hard refresh to update all UI elements
      router.refresh()
      // Also refetch the history
      fetchHistory(pagination.page)
    }
    
    setAcknowledgingIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(notificationId)
      return newSet
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatTimeOnly = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("fr-CA", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="type-filter">Type de notification</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
                <SelectTrigger id="type-filter">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="manual_message">Messages manuels</SelectItem>
                  <SelectItem value="replacement_available">Remplacements disponibles</SelectItem>
                  <SelectItem value="replacement_accepted">Remplacements acceptés</SelectItem>
                  <SelectItem value="replacement_rejected">Remplacements rejetés</SelectItem>
                  <SelectItem value="replacement_cancelled">Remplacements annulés</SelectItem>
                  <SelectItem value="assignment_notification">Affectations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Statut de livraison</Label>
              <Select
                value={filters.deliveryStatus}
                onValueChange={(value) => handleFilterChange("deliveryStatus", value)}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="partial">Partiel</SelectItem>
                  <SelectItem value="skipped">Ignoré</SelectItem>
                  <SelectItem value="failed">Échec</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Date de début</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Date de fin</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des notifications */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Chargement...</CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Aucune notification trouvée</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const totalFailedChannels =
              notification.recipients?.reduce((count, recipient) => {
                return count + (recipient.channels_failed?.length || 0)
              }, 0) || 0

            const hasErrors = totalFailedChannels > 0

            return (
              <Card key={notification.id} className="hover:bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{typeLabels[notification.type] || `📬 ${notification.type}`}</span>
                      {hasErrors && !notification.error_acknowledged && (
                          <span className="text-amber-600 text-lg">⚠️</span>
                        )}
                        {notification.delivery_status && (
                          <span
                            className={`text-sm font-medium ${statusLabels[notification.delivery_status]?.color || ""}`}
                          >
                            {statusLabels[notification.delivery_status]?.label || notification.delivery_status}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{formatDate(notification.created_at)}</p>

                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium">{notification.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div>
                          Envoyé par:{" "}
                          <span className="font-medium text-foreground">{notification.sent_by_name || "Système"}</span>
                        </div>
                      </div>

                      <div className="mt-3 rounded-md border bg-card p-3">
                        <p className="mb-2 text-sm font-medium">
                          Destinataires ({notification.recipients?.length || 0}):
                        </p>
                        <div className="space-y-1">
                          {notification.recipients?.map((recipient, index) => (
                            <div key={`${recipient.user_id}-${index}`} className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{recipient.user_name}</span>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-muted-foreground">
                                {recipient.channels_sent && recipient.channels_sent.length > 0
                                  ? recipient.channels_sent.join(", ")
                                  : "in_app"}
                              </span>
                              {recipient.created_at && (
                                <span className="text-xs text-muted-foreground/60">
                                  ({formatTimeOnly(recipient.created_at)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {hasErrors && (
                        <div className={`mt-3 rounded-md border border-red-200 p-3 ${notification.error_acknowledged ? "bg-red-50/50" : "bg-red-50"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                              <AlertTriangle className="h-4 w-4" />
                              Erreurs d'envoi ({totalFailedChannels})
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledgeError(notification.id)}
                              disabled={acknowledgingIds.has(notification.id) || notification.error_acknowledged === true}
                              className="h-7 border-red-300 hover:bg-red-100"
                            >
                              {acknowledgingIds.has(notification.id) ? "..." : notification.error_acknowledged ? "✓ Traité" : "✓ Pris en compte"}
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {notification.recipients?.map((recipient) => {
                              if (!recipient.channels_failed || recipient.channels_failed.length === 0) return null
                              return (
                                <div key={recipient.user_id} className="text-sm text-red-700">
                                  <span className="font-medium">{recipient.user_name}</span>
                                  <span className="text-red-600">
                                    {" "}
                                    - {recipient.channels_failed.join(", ")} échoué(s)
                                  </span>
                                  {recipient.error_message && (
                                    <span className="text-red-500 text-xs block ml-4">
                                      Raison: {recipient.error_message}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} sur {pagination.totalPages} ({pagination.totalCount} notification(s) au total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
