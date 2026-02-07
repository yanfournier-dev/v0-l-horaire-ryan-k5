import { getSession } from "@/app/actions/auth"
import { getNotificationErrorsCount } from "@/app/actions/get-notification-history"

export async function NotificationErrorsBadge() {
  const user = await getSession()
  if (!user || !user.is_admin) return null

  const count = await getNotificationErrorsCount()

  if (count === 0) return null

  return <span className="ml-2 text-amber-600 text-lg">⚠️</span>
}
