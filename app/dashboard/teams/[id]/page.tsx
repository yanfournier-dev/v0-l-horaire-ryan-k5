import { getSession } from "@/app/actions/auth"
import { getTeamMembers, getAvailableFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { RemoveMemberButton } from "@/components/remove-member-button"
import { getTeamColor } from "@/lib/colors"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = "force-dynamic"

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) redirect("/login")

  const { id } = params
  const teamId = Number.parseInt(id)

  const teamResult = await sql`
    SELECT * FROM teams WHERE id = ${teamId}
  `

  if (teamResult.length === 0) {
    redirect("/dashboard/teams")
  }

  const team = teamResult[0]
  const members = await getTeamMembers(teamId)
  const availableFirefighters = user.is_admin ? await getAvailableFirefighters(teamId) : []

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
      <div className="mb-6">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour aux équipes
          </Button>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{team.name}</h1>
              <Badge className={getTeamColor(team.name, team.color)}>{team.name}</Badge>
            </div>
            <p className="text-muted-foreground">
              {members.length} / {team.capacity} membres
            </p>
          </div>

          {user.is_admin && <AddMemberDialog teamId={teamId} availableFirefighters={availableFirefighters} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member: any) => (
          <Card key={member.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {member.first_name} {member.last_name}
                  </CardTitle>
                  <CardDescription>{member.email}</CardDescription>
                </div>
                <Badge className={getRoleBadgeColor(member.role)}>{getRoleLabel(member.role)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {member.phone && <p className="text-sm text-muted-foreground mb-2">📞 {member.phone}</p>}
              <p className="text-xs text-muted-foreground mb-3">
                Membre depuis {parseLocalDate(member.joined_at).toLocaleDateString("fr-CA")}
              </p>

              {user.is_admin && <RemoveMemberButton teamId={teamId} userId={member.id} />}
            </CardContent>
          </Card>
        ))}

        {members.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucun membre dans cette équipe</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
