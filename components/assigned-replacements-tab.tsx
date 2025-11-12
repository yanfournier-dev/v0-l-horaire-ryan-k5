"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { EditReplacementAssignmentButton } from "@/components/edit-replacement-assignment-button"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate, formatShortDate, formatCreatedAt } from "@/lib/date-utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"
import { sendAssignmentNotifications, sendAllPendingNotifications } from "@/app/actions/replacements"
import { toast } from "sonner"
import { Mail, Send, CheckCircle2, Clock } from "lucide-react"

interface AssignedReplacementsTabProps {
  allReplacements: any[]
  isAdmin: boolean
}

export function AssignedReplacementsTab({ allReplacements, isAdmin }: AssignedReplacementsTabProps) {
  const [sortBy, setSortBy] = useState<"date" | "created_at" | "name" | "replacement">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [sendingNotifications, setSendingNotifications] = useState<{ [key: number]: boolean }>({})
  const [sendingAll, setSendingAll] = useState(false)

  const assignedReplacements = allReplacements.filter((r) => r.status === "assigned")

  const pendingNotificationsCount = assignedReplacements.filter((r) => !r.notifications_sent_at).length

  const handleSendNotifications = async (replacementId: number, replacementInfo: string) => {
    setSendingNotifications((prev) => ({ ...prev, [replacementId]: true }))

    try {
      const result = await sendAssignmentNotifications(replacementId)

      if (result.success) {
        const parts = []
        if (result.emailsSent && result.emailsSent > 0) {
          parts.push(`${result.emailsSent} email(s)`)
        }
        if (result.smsSent && result.smsSent > 0) {
          parts.push(`${result.smsSent} SMS`)
        }

        const message =
          parts.length > 0
            ? `Notifications envoyées: ${parts.join(", ")}`
            : "Aucune notification à envoyer (préférences utilisateurs)"

        toast.success(message)

        if (result.errors && result.errors.length > 0) {
          toast.warning(`Erreurs: ${result.errors.join(", ")}`)
        }
      } else {
        toast.error(result.error || "Erreur lors de l'envoi")
      }
    } catch (error) {
      console.error("[v0] Error sending notifications:", error)
      toast.error("Erreur lors de l'envoi des notifications")
    } finally {
      setSendingNotifications((prev) => ({ ...prev, [replacementId]: false }))
    }
  }

  const handleSendAllNotifications = async () => {
    setSendingAll(true)

    try {
      const result = await sendAllPendingNotifications()

      if (result.success) {
        if (result.count === 0) {
          toast.info("Aucune notification en attente")
        } else {
          const parts = []
          if (result.emailsSent && result.emailsSent > 0) {
            parts.push(`${result.emailsSent} email(s)`)
          }
          if (result.smsSent && result.smsSent > 0) {
            parts.push(`${result.smsSent} SMS`)
          }

          toast.success(`${result.count} remplacement(s) notifiés: ${parts.join(", ")}`)

          if (result.errors && result.errors.length > 0) {
            toast.warning(`Erreurs: ${result.errors.join(", ")}`)
          }
        }
      } else {
        toast.error(result.error || "Erreur lors de l'envoi")
      }
    } catch (error) {
      console.error("[v0] Error sending all notifications:", error)
      toast.error("Erreur lors de l'envoi des notifications")
    } finally {
      setSendingAll(false)
    }
  }

  const sortedReplacements = [...assignedReplacements].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "date":
        comparison = compareShifts(a, b, parseLocalDate)
        break
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case "name":
        const nameA = a.user_id === null ? "Pompier supplémentaire" : `${a.first_name} ${a.last_name}`
        const nameB = b.user_id === null ? "Pompier supplémentaire" : `${b.first_name} ${b.last_name}`
        comparison = nameA.localeCompare(nameB)
        break
      case "replacement":
        const replacementA = a.assigned_first_name ? `${a.assigned_first_name} ${a.assigned_last_name}` : "Zzz"
        const replacementB = b.assigned_first_name ? `${b.assigned_first_name} ${b.assigned_last_name}` : "Zzz"
        comparison = replacementA.localeCompare(replacementB)
        break
      default:
        comparison = 0
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="created_at">Date de création</SelectItem>
              <SelectItem value="name">Pompier à remplacer</SelectItem>
              <SelectItem value="replacement">Remplaçant</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
          >
            {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>

        {isAdmin && pendingNotificationsCount > 0 && (
          <Button onClick={handleSendAllNotifications} disabled={sendingAll} size="sm" className="gap-2">
            <Send className="h-4 w-4" />
            {sendingAll ? "Envoi en cours..." : `Envoyer toutes (${pendingNotificationsCount})`}
          </Button>
        )}
      </div>

      {sortedReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun remplacement assigné</p>
          </CardContent>
        </Card>
      ) : (
        sortedReplacements.map((replacement: any) => {
          const candidateCount = Number.parseInt(replacement.application_count) || 0
          const notificationsSent = !!replacement.notifications_sent_at
          const isSending = sendingNotifications[replacement.id]

          return (
            <Card key={replacement.id} className="overflow-hidden">
              <CardContent className="py-0 px-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 min-w-[140px]">
                    <span className="font-medium leading-none">{formatShortDate(replacement.shift_date)}</span>
                    <Badge
                      className={`${getShiftTypeColor(replacement.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}
                    >
                      {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                    </Badge>
                    <PartTimeTeamBadge shiftDate={replacement.shift_date} />
                  </div>

                  <div className="flex-1 min-w-0 leading-none">
                    {replacement.user_id === null ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire</span>
                    ) : (
                      <span className="truncate">
                        {replacement.first_name} {replacement.last_name}
                      </span>
                    )}
                    {replacement.is_partial && (
                      <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">
                        ({replacement.start_time?.slice(0, 5)}-{replacement.end_time?.slice(0, 5)})
                      </span>
                    )}
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Créé {formatCreatedAt(replacement.created_at)}
                    </div>
                  </div>

                  {replacement.assigned_first_name && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 shrink-0 leading-none font-medium">
                      → {replacement.assigned_first_name} {replacement.assigned_last_name}
                    </div>
                  )}

                  <div className="shrink-0 flex items-center gap-1">
                    {notificationsSent ? (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Email envoyé</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Email non envoyé</span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm px-1.5 py-0 h-5 leading-none">
                      Assigné
                    </Badge>
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    {isAdmin && !notificationsSent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2 gap-1 bg-transparent leading-none"
                        onClick={() =>
                          handleSendNotifications(
                            replacement.id,
                            `${replacement.assigned_first_name} ${replacement.assigned_last_name}`,
                          )
                        }
                        disabled={isSending}
                      >
                        <Mail className="h-3 w-3" />
                        {isSending ? "Envoi..." : "Envoyer"}
                      </Button>
                    )}

                    <Link href={`/dashboard/replacements/${replacement.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2 gap-0.5 bg-transparent leading-none"
                      >
                        Voir ({candidateCount})
                      </Button>
                    </Link>
                    {isAdmin && replacement.assigned_first_name && (
                      <EditReplacementAssignmentButton
                        replacementId={replacement.id}
                        currentFirefighterName={`${replacement.assigned_first_name} ${replacement.assigned_last_name}`}
                      />
                    )}
                    {isAdmin && <DeleteReplacementButton replacementId={replacement.id} />}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
