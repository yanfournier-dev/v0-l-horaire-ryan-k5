import { getSession } from "@/app/actions/auth"
import {
  getRecentReplacements,
  getAllReplacements,
  getUserApplications,
  getPendingReplacementRequests,
  getUserReplacementRequests,
  getExpiredReplacements,
  getDirectAssignments,
  getAssignedReplacements, // Added import for assigned replacements
} from "@/app/actions/replacements"
import { getAllFirefighters } from "@/app/actions/teams"
import { redirect } from "next/navigation"
import { ScrollToReplacement } from "@/components/scroll-to-replacement"
import { ReplacementsTabs } from "@/components/replacements-tabs"

export const dynamic = "force-dynamic"

export default async function ReplacementsPage({
  searchParams,
}: {
  searchParams: { tab?: string; dateFilter?: string; sortOrder?: string }
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  // Batch 1: High priority queries (needed for all users)
  const [recentReplacements, userApplications] = await Promise.all([
    getRecentReplacements(),
    getUserApplications(user.id),
  ])

  // Batch 2: Medium priority queries (needed for main display)
  const [allReplacements, userRequests, directAssignments] = await Promise.all([
    user.is_admin ? getAllReplacements() : Promise.resolve([]),
    getUserReplacementRequests(user.id),
    getDirectAssignments(), // Added direct assignments to batch 2
  ])

  // Batch 3: Low priority queries (admin-only features)
  const dateFilter = (searchParams.dateFilter as "all" | "upcoming" | "7days" | "30days") || "upcoming"
  const sortOrder = (searchParams.sortOrder as "asc" | "desc") || "desc"
  const [firefighters, pendingRequests, expiredReplacements, assignedReplacementsData] = await Promise.all([
    user.is_admin ? getAllFirefighters() : Promise.resolve([]),
    user.is_admin ? getPendingReplacementRequests() : Promise.resolve([]),
    user.is_admin ? getExpiredReplacements() : Promise.resolve([]),
    user.is_admin
      ? getAssignedReplacements(dateFilter, sortOrder)
      : Promise.resolve({ replacements: [], unsentCount: 0, unconfirmedCount: 0 }), // Added unconfirmedCount
  ])

  const initialTab = searchParams.tab || "available"

  return (
    <div className="p-6">
      <ScrollToReplacement />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Remplacements</h1>
        <p className="text-muted-foreground">Postulez pour des remplacements disponibles</p>
      </div>

      <ReplacementsTabs
        recentReplacements={recentReplacements}
        userApplications={userApplications}
        allReplacements={allReplacements}
        firefighters={firefighters}
        pendingRequests={pendingRequests}
        userRequests={userRequests}
        expiredReplacements={expiredReplacements}
        directAssignments={directAssignments}
        assignedReplacements={assignedReplacementsData.replacements}
        assignedUnsentCount={assignedReplacementsData.unsentCount}
        assignedUnconfirmedCount={assignedReplacementsData.unconfirmedCount} // Added unconfirmed count
        isAdmin={user.is_admin}
        userId={user.id}
        initialTab={initialTab}
      />
    </div>
  )
}
