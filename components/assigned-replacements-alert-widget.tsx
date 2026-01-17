import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { formatLocalDate } from "@/lib/date-utils"
import { getAssignedReplacementsNeedingAttention } from "@/app/actions/replacements"
import { Badge } from "@/components/ui/badge"

export async function AssignedReplacementsAlertWidget() {
  const replacements = await getAssignedReplacementsNeedingAttention()

  if (replacements.length === 0) {
    return null
  }

  const unsentCount = replacements.filter((r: any) => !r.notification_sent_at).length
  const unconfirmedCount = replacements.filter((r: any) => r.notification_sent_at && !r.confirmed_at).length

  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <CardTitle className="text-lg">
            Remplacements assignés nécessitant attention ({replacements.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {replacements.map((replacement: any) => {
          const isUnsent = !replacement.notification_sent_at
          const isUrgent = replacement.deadline_duration === 900 || replacement.deadline_duration === -1
          const timeSinceNotification = replacement.notification_sent_at
            ? Math.floor((Date.now() - new Date(replacement.notification_sent_at).getTime()) / (1000 * 60))
            : 0

          return (
            <div key={replacement.id} className="flex items-start gap-2 p-2 rounded-md bg-background/50 text-sm">
              <Badge
                variant="secondary"
                className={
                  isUnsent ? "bg-red-500 text-white hover:bg-red-600" : "bg-orange-500 text-white hover:bg-orange-600"
                }
              >
                {isUnsent ? "🔴" : "🟠"}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {formatLocalDate(replacement.shift_date)} - {replacement.first_name} {replacement.last_name} →{" "}
                  {replacement.assigned_first_name} {replacement.assigned_last_name}
                </div>
                <div className="text-muted-foreground text-xs">
                  {isUnsent ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">Notification non envoyée</span>
                  ) : isUrgent ? (
                    <span>
                      Non confirmé ({timeSinceNotification} min) - <strong>URGENT</strong>
                    </span>
                  ) : (
                    <span>Non confirmé ({Math.floor(timeSinceNotification / 60)}h)</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {replacements.length >= 5 && (
          <div className="text-center text-sm text-muted-foreground pt-2">
            + d'autres remplacements nécessitant attention
          </div>
        )}

        <Link
          href="/dashboard/replacements?tab=assigned"
          className="block text-center mt-4 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
        >
          Voir tous les remplacements assignés →
        </Link>
      </CardContent>
    </Card>
  )
}
