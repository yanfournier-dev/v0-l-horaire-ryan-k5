import { getSession } from "@/app/actions/auth"
import { getUnreadCount } from "@/app/actions/notifications"
import { Badge } from "@/components/ui/badge"

export async function NotificationBadge() {
  const user = await getSession()
  if (!user) return null

  const unreadCount = await getUnreadCount(user.id)

  if (unreadCount === 0) return null

  return <Badge className="ml-2 bg-red-600 text-white hover:bg-red-700">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
}
