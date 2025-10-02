import { getSession } from "@/lib/auth"
import { getRecentReplacements, getAllReplacements, getUserApplications } from "@/app/actions/replacements"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { AvailableReplacementsTab } from "@/components/available-replacements-tab"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"

export default async function ReplacementsPage({
  searchParams,
}: {
  searchParams: { sortBy?: string }
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  const recentReplacements = await getRecentReplacements()
  const userApplications = await getUserApplications(user.id)
  const allReplacements = user.is_admin ? await getAllReplacements() : []

  const sortBy = searchParams.sortBy || "date"

  const sortReplacements = (replacements: any[]) => {
    const sorted = [...replacements]
    if (sortBy === "name") {
      sorted.sort((a, b) => a.first_name.localeCompare(b.first_name))
    } else if (sortBy === "team") {
      sorted.sort((a, b) => a.team_name.localeCompare(b.team_name))
    } else {
      sorted.sort((a, b) => new Date(a.shift_date).getTime() - new Date(b.shift_date).getTime())
    }
    return sorted
  }

  const groupByShift = (replacements: any[]) => {
    const groups: Record<string, any[]> = {}
    replacements.forEach((replacement) => {
      const key = `${replacement.shift_date}_${replacement.shift_type}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(replacement)
    })
    return groups
  }

  const sortedRecentReplacements = sortReplacements(recentReplacements)
  const groupedReplacements = groupByShift(sortedRecentReplacements)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "approved":
        return "Approuvée"
      case "rejected":
        return "Rejetée"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getReplacementStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Ouvert"
      case "assigned":
        return "Assigné"
      case "completed":
        return "Complété"
      case "cancelled":
        return "Annulé"
      default:
        return status
    }
  }

  const getReplacementStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "assigned":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "completed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Remplacements</h1>
        <p className="text-muted-foreground">Postulez pour des quarts de remplacement disponibles</p>
      </div>

      <Tabs defaultValue="open" className="space-y-6">
        <TabsList>
          <TabsTrigger value="open">
            Disponibles ({recentReplacements.filter((r) => r.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="my-applications">Mes candidatures ({userApplications.length})</TabsTrigger>
          {user.is_admin && <TabsTrigger value="all">Tous les remplacements</TabsTrigger>}
        </TabsList>

        <TabsContent value="open">
          <AvailableReplacementsTab groupedReplacements={groupedReplacements} userApplications={userApplications} />
        </TabsContent>

        <TabsContent value="my-applications" className="space-y-4">
          {userApplications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Vous n'avez pas encore postulé pour des remplacements</p>
              </CardContent>
            </Card>
          ) : (
            userApplications.map((application: any) => (
              <Card key={application.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {new Date(application.shift_date).toLocaleDateString("fr-CA", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </CardTitle>
                      <CardDescription>
                        Remplace {application.first_name} {application.last_name} • {application.team_name}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={getShiftTypeColor(application.shift_type)}>
                        {getShiftTypeLabel(application.shift_type).split(" ")[0]}
                      </Badge>
                      <Badge className={getStatusColor(application.status)}>{getStatusLabel(application.status)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p>Postulé le {new Date(application.applied_at).toLocaleDateString("fr-CA")}</p>
                    {application.status !== "pending" && application.reviewer_first_name && (
                      <p>
                        {application.status === "approved" ? "Approuvée" : "Rejetée"} par{" "}
                        {application.reviewer_first_name} {application.reviewer_last_name} le{" "}
                        {new Date(application.reviewed_at).toLocaleDateString("fr-CA")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {user.is_admin && (
          <TabsContent value="all" className="space-y-4">
            <div className="flex justify-end mb-4">
              <Link href="/dashboard/replacements/manage">
                <Button className="bg-red-600 hover:bg-red-700">Créer un remplacement</Button>
              </Link>
            </div>

            {allReplacements.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Aucun remplacement</p>
                </CardContent>
              </Card>
            ) : (
              allReplacements.map((replacement: any) => (
                <Card key={replacement.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {new Date(replacement.shift_date).toLocaleDateString("fr-CA", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </CardTitle>
                        <CardDescription>
                          Remplace {replacement.first_name} {replacement.last_name} • {replacement.team_name}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={getShiftTypeColor(replacement.shift_type)}>
                          {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                        </Badge>
                        <Badge className={getReplacementStatusColor(replacement.status)}>
                          {getReplacementStatusLabel(replacement.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {replacement.status === "assigned" && replacement.assigned_first_name && (
                          <p>
                            Assigné à {replacement.assigned_first_name} {replacement.assigned_last_name}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/dashboard/replacements/${replacement.id}`}>
                          <Button variant="outline" size="sm">
                            Voir les candidatures
                          </Button>
                        </Link>
                        <DeleteReplacementButton replacementId={replacement.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
