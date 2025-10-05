import { getSession } from "@/lib/auth"
import { getRecentReplacements, getAllReplacements, getUserApplications } from "@/app/actions/replacements"
import { getAllFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { ScrollToReplacement } from "@/components/scroll-to-replacement"
import { ReplacementsTabs } from "@/components/replacements-tabs"

export const dynamic = "force-dynamic"

export default async function ReplacementsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  const recentReplacements = await getRecentReplacements()
  const userApplications = await getUserApplications(user.id)
  const allReplacements = user.is_admin ? await getAllReplacements() : []
  const firefighters = user.is_admin ? await getAllFirefighters() : []

  const initialTab = searchParams.tab || "open"

  return (
    <div className="p-6">
      <ScrollToReplacement />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Remplacements</h1>
        <p className="text-muted-foreground">Postulez pour des quarts de remplacement disponibles</p>
      </div>

      <ReplacementsTabs
        recentReplacements={recentReplacements}
        userApplications={userApplications}
        allReplacements={allReplacements}
        firefighters={firefighters}
        isAdmin={user.is_admin}
        initialTab={initialTab}
      />
    </div>
  )
}
