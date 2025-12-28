import { getSession } from "@/app/actions/auth"
import { getUserLeaves, getAllLeaves } from "@/app/actions/leaves"
import { getAllFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { AbsencesTabs } from "@/components/absences-tabs"

export const dynamic = "force-dynamic"

export default async function AbsencesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getSession()
  if (!user) redirect("/login")

  const [userLeaves, allLeaves, firefighters] = await Promise.all([
    getUserLeaves(user.id),
    user.is_admin ? getAllLeaves() : Promise.resolve([]),
    user.is_admin ? getAllFirefighters() : Promise.resolve([]),
  ])

  const initialTab = searchParams.tab || "all"

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Absences</h1>
        <p className="text-muted-foreground">Gérez les absences des pompiers</p>
      </div>

      <AbsencesTabs
        userLeaves={userLeaves}
        allLeaves={allLeaves}
        firefighters={firefighters}
        isAdmin={user.is_admin}
        userId={user.id}
        initialTab={initialTab}
      />
    </div>
  )
}
