import { getSession } from "@/lib/auth"
import { getTeams } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getTeamColor } from "@/lib/colors"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const user = await getSession()
  if (!user) redirect("/login")

  const teams = await getTeams()

  const getTeamTypeLabel = (type: string) => {
    switch (type) {
      case "permanent":
        return "Permanente"
      case "part_time":
        return "Temps partiel"
      case "temporary":
        return "Temporaire"
      default:
        return type
    }
  }

  const getTeamTypeColor = (type: string) => {
    switch (type) {
      case "permanent":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "part_time":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "temporary":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Équipes</h1>
          <p className="text-muted-foreground">Gérez les équipes et leurs membres</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team: any) => (
          <Link key={team.id} href={`/dashboard/teams/${team.id}`}>
            <Card
              className={`hover:shadow-lg transition-shadow cursor-pointer h-full border-2 ${getTeamColor(team.name, team.color)}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl">{team.name}</CardTitle>
                  <Badge className={getTeamTypeColor(team.type)}>{getTeamTypeLabel(team.type)}</Badge>
                </div>
                <CardDescription>
                  {team.capacity >= 999
                    ? `${team.member_count} membres (illimité)`
                    : `${team.member_count} / ${team.capacity} membres`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {team.capacity < 999 && (
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((team.member_count / team.capacity) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
