import { getTelegramConnectionStatus } from "@/app/actions/telegram-status"
import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { TelegramStatusTable } from "@/components/telegram-status-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function TelegramStatusPage() {
  const user = await getSession()

  if (!user?.is_admin) {
    redirect("/dashboard")
  }

  const data = await getTelegramConnectionStatus()

  if ("error" in data) {
    return (
      <div className="p-6">
        <p className="text-red-500">{data.error}</p>
      </div>
    )
  }

  const { users, stats, currentUserId, currentUserIsOwner } = data

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Connexions Telegram</h1>
        <p className="text-muted-foreground">
          Suivez qui a connecté Telegram pour recevoir les notifications critiques
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Pompiers dans le système</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Connectés</CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-400">{stats.connected}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {stats.percentage}% du total
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Non connectés</CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">{stats.notConnected}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.notConnected > 0 ? (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Nécessite attention
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Tous connectés
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <TelegramStatusTable users={users} currentUserId={currentUserId} currentUserIsOwner={currentUserIsOwner} />
    </div>
  )
}
