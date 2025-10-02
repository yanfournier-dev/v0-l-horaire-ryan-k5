import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { getUserLeaves } from "@/app/actions/leaves"
import { getUserApplications } from "@/app/actions/replacements"
import { getUnreadCount } from "@/app/actions/notifications"
import { Badge } from "@/components/ui/badge"
import { getRoleLabel } from "@/lib/role-labels"

export default async function DashboardPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  const leaves = await getUserLeaves(user.id)
  const pendingLeaves = leaves.filter((l: any) => l.status === "pending")
  const applications = await getUserApplications(user.id)
  const pendingApplications = applications.filter((a: any) => a.status === "pending")
  const unreadNotifications = await getUnreadCount(user.id)

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

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/calendar">
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

        <Link href="/dashboard/leaves">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl">Demandes d'absence</CardTitle>
                  <CardDescription className="text-sm">Gérez vos congés et absences</CardDescription>
                </div>
                {pendingLeaves.length > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {pendingLeaves.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🏖️</div>
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
                {pendingApplications.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {pendingApplications.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🔄</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/notifications">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
                  <CardDescription className="text-sm">Restez informé des mises à jour</CardDescription>
                </div>
                {unreadNotifications > 0 && <Badge className="bg-red-600 text-white">{unreadNotifications}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🔔</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/teams">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Équipes</CardTitle>
              <CardDescription className="text-sm">Consultez les équipes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">👥</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/firefighters">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Pompiers</CardTitle>
              <CardDescription className="text-sm">Liste de tous les pompiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl">🚒</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
