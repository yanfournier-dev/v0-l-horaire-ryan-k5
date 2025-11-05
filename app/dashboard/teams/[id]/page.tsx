import { getSession } from "@/app/actions/auth"
import { getTeamMembers, getAvailableFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { getTeamColor } from "@/lib/colors"
import { TeamMembersSortableList } from "@/components/team-members-sortable-list"

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

      <TeamMembersSortableList members={members} teamId={teamId} isAdmin={user.is_admin} />
    </div>
  )
}
