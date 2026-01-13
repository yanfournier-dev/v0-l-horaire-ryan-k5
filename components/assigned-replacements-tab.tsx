"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, Check, Send, ArrowUpDown, AlertCircle } from "lucide-react"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { formatShortDate, formatLocalDateTime } from "@/lib/date-utils"
import { sendAssignmentNotification } from "@/app/actions/send-assignment-notification"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AssignedReplacementsTabProps {
  assignedReplacements: any[]
  unsentCount: number
}

function formatCreatedAt(createdAt: string) {
  const date = new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `le ${date.toLocaleDateString("fr-CA")} à ${date.toLocaleTimeString("fr-CA", {
      hour: "2-digit",
      minute: "2-digit",
    })}`
  } else if (diffDays < 30) {
    return `le ${date.toLocaleDateString("fr-CA", {
      month: "short",
      day: "numeric",
    })} à ${date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
  } else {
    return `le ${date.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`
  }
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
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({ open: false, message: "" })
  const [isUpdating, setIsUpdating] = useState(false)

  console.log(
    "[v0] assignedReplacements data:",
    assignedReplacements.map((r) => ({
      id: r.id,
      shift_date: r.shift_date,
      notification_sent: r.notification_sent,
      notification_types_sent: r.notification_types_sent,
      notification_channels_failed: r.notification_channels_failed,
    })),
  )

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
      setIsUpdating(true)
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.set("tab", "assigned")
        window.location = url.href
      }, 2000)
    } else {
      setErrorDialog({
        open: true,
        message: result.error || "Erreur lors de l'envoi de la notification",
      })
    }

    setSendingIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(replacementId)
      return newSet
    })
  }

  const handleSendAllNotifications = async () => {
    const unsentReplacements = assignedReplacements.filter((r) => !r.notification_sent)

    setIsUpdating(true)

    for (const replacement of unsentReplacements) {
      setSendingIds((prev) => new Set(prev).add(replacement.id))
      await sendAssignmentNotification(replacement.id)
      setSendingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(replacement.id)
        return newSet
      })
    }

    setTimeout(() => {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", "assigned")
      window.location = url.href
    }, 2000)
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value as "all" | "upcoming" | "7days" | "30days")
    const params = new URLSearchParams(window.location.search)
    params.set("dateFilter", value)
    params.set("sortOrder", sortOrder)
    router.push(`/dashboard/replacements?tab=assigned&${params.toString()}`)
  }

  const handleSortOrderToggle = () => {
    const newOrder = sortOrder === "desc" ? "asc" : "desc"
    setSortOrder(newOrder)
    const params = new URLSearchParams(window.location.search)
    params.set("dateFilter", dateFilter)
    params.set("sortOrder", newOrder)
    router.push(`/dashboard/replacements?tab=assigned&${params.toString()}`)
  }

  const unsentCountCurrent = assignedReplacements.filter((r) => !r.notification_sent).length

  return (
    <div className="space-y-4">
      {isUpdating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-900">Mise à jour en cours...</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
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
          <Button onClick={handleSendAllNotifications} className="gap-2" disabled={isUpdating}>
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
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium whitespace-nowrap">{formatShortDate(replacement.shift_date)}</span>
                      <Badge className={`${getShiftTypeColor(replacement.shift_type)} text-xs shrink-0`}>
                        {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm">
                        {replacement.first_name} {replacement.last_name}
                      </span>
                      <span className="text-sm text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-blue-600">
                        {replacement.assigned_first_name} {replacement.assigned_last_name}
                      </span>
                    </div>

                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Créé {formatCreatedAt(replacement.created_at)}
                    </div>

                    <div className="mt-1.5">
                      {replacement.notification_sent ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-green-600 font-medium">
                            Notification envoyée {formatLocalDateTime(replacement.notification_sent_at)}
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
                          {replacement.notification_channels_failed &&
                            replacement.notification_channels_failed.length > 0 && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Échec: {replacement.notification_channels_failed.join(", ")}
                                </Badge>
                              </>
                            )}
                          {replacement.notification_sent_by_first_name && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">
                                Par {replacement.notification_sent_by_first_name}{" "}
                                {replacement.notification_sent_by_last_name}
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Bell className="h-3.5 w-3.5 text-orange-600" />
                          <span className="text-orange-600 font-medium">Notification non envoyée</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    <Link href={`/dashboard/replacements/${replacement.id}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs px-2 bg-transparent w-[140px]">
                        Voir les candidats ({replacement.candidate_count || 0})
                      </Button>
                    </Link>

                    {!replacement.notification_sent && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs px-2 w-[100px]"
                        onClick={() => handleSendNotification(replacement.id)}
                        disabled={sendingIds.has(replacement.id) || isUpdating}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {sendingIds.has(replacement.id) ? "..." : "Envoyer"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <AlertDialogTitle>Notification non envoyée</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">{errorDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialog({ open: false, message: "" })}>Compris</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
