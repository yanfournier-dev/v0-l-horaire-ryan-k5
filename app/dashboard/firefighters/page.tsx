import { getSession } from "@/app/actions/auth"
import { getAllFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { AddFirefighterDialog } from "@/components/add-firefighter-dialog"
import { sql } from "@/lib/db"
import { FirefightersList } from "@/components/firefighters-list"

export const dynamic = "force-dynamic"

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

      <FirefightersList firefighters={firefighters} teams={teams} isAdmin={user.is_admin} />
    </div>
  )
}
