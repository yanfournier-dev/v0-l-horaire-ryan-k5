import { getSession } from "@/app/actions/auth"
import { getTeams } from "@/app/actions/teams"
import { redirect } from "next/navigation"
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

      <div className="space-y-2">
        {teams.map((team: any) => (
          <Link key={team.id} href={`/dashboard/teams/${team.id}`}>
            <div
              className={`flex items-center justify-between p-4 rounded-lg border-2 hover:shadow-md transition-shadow cursor-pointer ${
                team.type === "permanent" ? getTeamColor(team.name, team.color) : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">{team.name}</h3>
                <Badge className={getTeamTypeColor(team.type)}>{getTeamTypeLabel(team.type)}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {team.member_count} {team.member_count === 1 ? "membre" : "membres"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
