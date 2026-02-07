import { getSession } from "@/app/actions/auth"
import { getNotificationErrorsCount } from "@/app/actions/get-notification-history"
import { Badge } from "@/components/ui/badge"

export async function NotificationErrorsBadge() {
  const user = await getSession()
  if (!user || !user.is_admin) return null

  const count = await getNotificationErrorsCount()

  if (count === 0) return null

  return (
    <Badge className="ml-2 bg-amber-600 text-white hover:bg-amber-700">
      {count > 99 ? "99+" : count}
    </Badge>
  )
}
