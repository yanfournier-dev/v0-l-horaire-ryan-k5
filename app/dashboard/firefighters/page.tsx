import { getSession } from "@/lib/auth"
import { getAllFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EditFirefighterDialog } from "@/components/edit-firefighter-dialog"
import { DeleteFirefighterButton } from "@/components/delete-firefighter-button"
import { AddFirefighterDialog } from "@/components/add-firefighter-dialog"
import { ResetPasswordDialog } from "@/components/reset-password-dialog"
import { sql } from "@/lib/db"

export default async function FirefightersPage() {
  const user = await getSession()
  if (!user) redirect("/login")

  const firefighters = await getAllFirefighters()

  const teams = user.is_admin
    ? await sql`
    SELECT id, name, type, color
    FROM teams
    ORDER BY name
  `
    : []

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "captain":
        return "Capitaine"
      case "lieutenant":
        return "Lieutenant"
      case "firefighter":
        return "Pompier"
      default:
        return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "captain":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "lieutenant":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pompiers</h1>
          <p className="text-muted-foreground">Liste de tous les pompiers</p>
        </div>
        {user.is_admin && <AddFirefighterDialog teams={teams} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {firefighters.map((firefighter: any) => (
          <Card key={firefighter.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {firefighter.first_name} {firefighter.last_name}
                  </CardTitle>
                  <CardDescription>{firefighter.email}</CardDescription>
                </div>
                <Badge className={getRoleBadgeColor(firefighter.role)}>{getRoleLabel(firefighter.role)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {firefighter.phone && <p className="text-sm text-muted-foreground mb-2">📞 {firefighter.phone}</p>}

              {firefighter.is_admin && (
                <Badge className="mb-3 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Administrateur</Badge>
              )}

              <div className="mb-3">
                <p className="text-xs font-semibold text-foreground mb-1">Équipes:</p>
                {firefighter.teams && firefighter.teams.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {firefighter.teams.map((team: any) => (
                      <Badge key={team.id} variant="outline" className="text-xs">
                        {team.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune équipe</p>
                )}
              </div>

              {user.is_admin && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <EditFirefighterDialog firefighter={firefighter} availableTeams={teams} />
                    <DeleteFirefighterButton userId={firefighter.id} />
                  </div>
                  <ResetPasswordDialog
                    userId={firefighter.id}
                    userName={`${firefighter.first_name} ${firefighter.last_name}`}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
