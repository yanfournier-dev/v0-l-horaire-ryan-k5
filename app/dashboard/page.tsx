import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { getUserApplications, getReplacementsAdminActionCount } from "@/app/actions/replacements"
import { getExchangesAdminActionCount } from "@/app/actions/exchanges"
import { Badge } from "@/components/ui/badge"
import { getRoleLabel } from "@/lib/role-labels"
import { TelegramAlertWidget } from "@/components/telegram-alert-widget"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  const applications = await getUserApplications(user.id)
  const pendingApplications = applications.filter((a: any) => a.status === "pending")

  let replacementsAdminCount = 0
  let exchangesAdminCount = 0

  if (user.is_admin) {
    replacementsAdminCount = await getReplacementsAdminActionCount()
    exchangesAdminCount = await getExchangesAdminActionCount()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Bienvenue, {user.first_name} {user.last_name}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Rôle: {getRoleLabel(user.role)}
          {user.is_admin && " (Administrateur)"}
        </p>
      </div>

      {user.is_admin && (
        <div className="mb-6">
          <TelegramAlertWidget />
        </div>
      )}

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/calendar?scrollToToday=true" scroll={false}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Calendrier 28 jours</CardTitle>
              <CardDescription className="text-sm">Consultez votre horaire de travail</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">📅</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/replacements">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl">Remplacements</CardTitle>
                  <CardDescription className="text-sm">Postulez pour des remplacements</CardDescription>
                </div>
                <div className="flex gap-2">
                  {user.is_admin && replacementsAdminCount > 0 && (
                    <Badge className="bg-red-500 text-white hover:bg-red-600">{replacementsAdminCount}</Badge>
                  )}
                  {!user.is_admin && pendingApplications.length > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {pendingApplications.length}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🔄</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/exchanges">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl">Échanges</CardTitle>
                  <CardDescription className="text-sm">Proposez et gérez vos échanges de quarts</CardDescription>
                </div>
                {user.is_admin && exchangesAdminCount > 0 && (
                  <Badge className="bg-red-500 text-white hover:bg-red-600">{exchangesAdminCount}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🔁</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/notifications">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
              <CardDescription className="text-sm">Restez informé des mises à jour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🔔</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Paramètres</CardTitle>
              <CardDescription className="text-sm">Gérez vos préférences et paramètres</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">⚙️</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
