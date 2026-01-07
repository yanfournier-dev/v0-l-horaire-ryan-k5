"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, Check, Send, ArrowUpDown } from "lucide-react"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { formatShortDate, formatLocalDateTime } from "@/lib/date-utils"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"
import { sendAssignmentNotification } from "@/app/actions/send-assignment-notification"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AssignedReplacementsTabProps {
  assignedReplacements: any[]
  unsentCount: number
}

export function AssignedReplacementsTab({
  assignedReplacements,
  unsentCount: initialUnsentCount,
}: AssignedReplacementsTabProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<"all" | "sent" | "not_sent">("all")
  const [sendingIds, setSendingIds] = useState<Set<number>>(new Set())
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "7days" | "30days">("upcoming")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const sortedReplacements = [...assignedReplacements].sort((a, b) => {
    const dateA = new Date(a.shift_date).getTime()
    const dateB = new Date(b.shift_date).getTime()
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA
  })

  const filteredReplacements = sortedReplacements.filter((r) => {
    if (filter === "sent") return r.notification_sent === true
    if (filter === "not_sent") return r.notification_sent !== true
    return true
  })

  const handleSendNotification = async (replacementId: number) => {
    setSendingIds((prev) => new Set(prev).add(replacementId))

    const result = await sendAssignmentNotification(replacementId)

    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || "Erreur lors de l'envoi de la notification")
    }

    setSendingIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(replacementId)
      return newSet
    })
  }

  const handleSendAllNotifications = async () => {
    const unsentReplacements = assignedReplacements.filter((r) => !r.notification_sent)

    for (const replacement of unsentReplacements) {
      await handleSendNotification(replacement.id)
    }
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value as "all" | "upcoming" | "7days" | "30days")
    // Refresh with new filter
    const params = new URLSearchParams(window.location.search)
    params.set("dateFilter", value)
    params.set("sortOrder", sortOrder)
    router.push(`/dashboard/replacements?tab=assigned&${params.toString()}`)
  }

  const handleSortOrderToggle = () => {
    const newOrder = sortOrder === "desc" ? "asc" : "desc"
    setSortOrder(newOrder)
    // Refresh with new sort order
    const params = new URLSearchParams(window.location.search)
    params.set("dateFilter", dateFilter)
    params.set("sortOrder", newOrder)
    router.push(`/dashboard/replacements?tab=assigned&${params.toString()}`)
  }

  const unsentCountCurrent = assignedReplacements.filter((r) => !r.notification_sent).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">À venir</SelectItem>
              <SelectItem value="7days">7 derniers jours</SelectItem>
              <SelectItem value="30days">30 derniers jours</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>

          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Tous ({assignedReplacements.length})
          </Button>
          <Button
            variant={filter === "not_sent" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("not_sent")}
          >
            Non envoyées ({unsentCountCurrent})
          </Button>
          <Button variant={filter === "sent" ? "default" : "outline"} size="sm" onClick={() => setFilter("sent")}>
            Envoyées ({assignedReplacements.length - unsentCountCurrent})
          </Button>

          <Button variant="outline" size="sm" onClick={handleSortOrderToggle} className="gap-2 bg-transparent">
            <ArrowUpDown className="h-4 w-4" />
            {sortOrder === "desc" ? "Plus récent" : "Plus ancien"}
          </Button>
        </div>

        {unsentCountCurrent > 0 && (
          <Button onClick={handleSendAllNotifications} className="gap-2">
            <Send className="h-4 w-4" />
            Envoyer toutes les notifications ({unsentCountCurrent})
          </Button>
        )}
      </div>

      {filteredReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === "sent" && "Aucune notification envoyée"}
              {filter === "not_sent" && "Aucune notification en attente"}
              {filter === "all" && "Aucun remplacement assigné"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredReplacements.map((replacement: any) => (
            <Card key={replacement.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatShortDate(replacement.shift_date)}</span>
                      <Badge className={`${getShiftTypeColor(replacement.shift_type)} text-xs`}>
                        {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                      </Badge>
                      <PartTimeTeamBadge shiftDate={replacement.shift_date} />
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm">
                        {replacement.replaced_first_name} {replacement.replaced_last_name}
                      </span>
                      <span className="text-sm text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-blue-600">
                        {replacement.assigned_first_name} {replacement.assigned_last_name}
                      </span>
                    </div>

                    {replacement.notification_sent ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">
                          Notification envoyée le {formatLocalDateTime(replacement.notification_sent_at)}
                        </span>
                        {replacement.notification_types_sent && replacement.notification_types_sent.length > 0 && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {replacement.notification_types_sent
                                .map((type: string) => {
                                  if (type === "email") return "Email"
                                  if (type === "sms") return "SMS"
                                  if (type === "telegram") return "Telegram"
                                  if (type === "app") return "App"
                                  return type
                                })
                                .join(", ")}
                            </span>
                          </>
                        )}
                        {replacement.sent_by_first_name && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              Par {replacement.sent_by_first_name} {replacement.sent_by_last_name}
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Bell className="h-4 w-4 text-orange-600" />
                        <span className="text-orange-600 font-medium">Notification non envoyée</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {!replacement.notification_sent && (
                      <Button
                        onClick={() => handleSendNotification(replacement.id)}
                        disabled={sendingIds.has(replacement.id)}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {sendingIds.has(replacement.id) ? "Envoi..." : "Envoyer la notification"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
