import Link from "next/link"
import { formatLocalDate } from "@/lib/date-utils"
import { getAssignedReplacementsNeedingAttention } from "@/app/actions/replacements"

export async function AssignedReplacementsAlertWidget() {
  console.log("[v0] AssignedReplacementsAlertWidget: Fetching replacements needing attention")
  const { items: replacements, total } = await getAssignedReplacementsNeedingAttention()
  console.log("[v0] AssignedReplacementsAlertWidget: Received replacements:", replacements?.length || 0)
  console.log("[v0] AssignedReplacementsAlertWidget: Replacements data:", JSON.stringify(replacements, null, 2))

  if (replacements.length === 0) {
    console.log("[v0] AssignedReplacementsAlertWidget: No replacements found, hiding widget")
    return null
  }

  console.log("[v0] AssignedReplacementsAlertWidget: Displaying widget with", replacements.length, "items")

  return (
    <div className="bg-orange-50/30 dark:bg-orange-950/10 px-3 py-2 rounded-md">
      <div className="space-y-0.5">
        {replacements.map((replacement: any) => {
          const isUnsent = !replacement.notification_sent_at
          const timeSinceNotification = replacement.notification_sent_at
            ? Math.floor((Date.now() - new Date(replacement.notification_sent_at).getTime()) / (1000 * 60))
            : 0

          return (
            <div key={replacement.id} className="flex items-center gap-1.5 text-xs">
              <span className="flex-shrink-0">{isUnsent ? "🔴" : "🟠"}</span>
              <span className="text-muted-foreground truncate">
                {formatLocalDate(replacement.shift_date)} - {replacement.first_name} {replacement.last_name} →{" "}
                {replacement.assigned_first_name} {replacement.assigned_last_name}
              </span>
              <span className="text-muted-foreground">•</span>
              <span
                className={
                  isUnsent
                    ? "text-red-600 dark:text-red-400 font-medium flex-shrink-0"
                    : "text-orange-600 dark:text-orange-400 flex-shrink-0"
                }
              >
                {isUnsent
                  ? "Non envoyée"
                  : timeSinceNotification < 60
                    ? `${timeSinceNotification} min`
                    : `${Math.floor(timeSinceNotification / 60)}h ${timeSinceNotification % 60}min`}
              </span>
            </div>
          )
        })}

        {total > replacements.length && (
          <div className="text-xs text-muted-foreground pt-0.5">
            + {total - replacements.length} autres remplacements nécessitant attention{" "}
            <Link
              href="/dashboard/replacements?tab=assigned"
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
            >
              Voir →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
