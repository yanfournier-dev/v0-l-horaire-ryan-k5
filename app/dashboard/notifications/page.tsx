import { getSession } from "@/app/actions/auth"
import { getUserNotifications } from "@/app/actions/notifications"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarkAsReadButton } from "@/components/mark-as-read-button"
import { DeleteNotificationButton } from "@/components/delete-notification-button"
import { MarkAllAsReadButton } from "@/components/mark-all-as-read-button"
import { DeleteAllNotificationsButton } from "@/components/delete-all-notifications-button"
import { NotificationTimestamp } from "@/components/notification-timestamp"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const user = await getSession()
  if (!user) redirect("/login")

  const notifications = await getUserNotifications(user.id)
  const unreadCount = notifications.filter((n: any) => !n.is_read).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "leave_approved":
      case "leave_rejected":
        return "📅"
      case "replacement_available":
      case "replacement_assigned":
        return "🔄"
      case "application_approved":
      case "application_rejected":
        return "✉️"
      case "team_update":
        return "👥"
      default:
        return "🔔"
    }
  }

  const getNotificationTypeColor = (type: string) => {
    if (type.includes("approved") || type.includes("assigned")) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    }
    if (type.includes("rejected")) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    }
    if (type.includes("available")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : "Toutes les notifications sont lues"}
          </p>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && <MarkAllAsReadButton />}
          {notifications.length > 0 && <DeleteAllNotificationsButton />}
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucune notification</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification: any) => (
            <Card key={notification.id} className={notification.is_read ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{notification.title}</CardTitle>
                      <CardDescription>{notification.message}</CardDescription>
                      <p className="text-xs text-muted-foreground mt-2">
                        <NotificationTimestamp timestamp={notification.created_at} />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <Badge className={getNotificationTypeColor(notification.type)}>Nouveau</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {!notification.is_read && <MarkAsReadButton notificationId={notification.id} />}
                  <DeleteNotificationButton notificationId={notification.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
