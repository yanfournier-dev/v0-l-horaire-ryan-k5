import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { getReplacementApplications } from "@/app/actions/replacements"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ApproveApplicationButton } from "@/components/approve-application-button"
import { RejectApplicationButton } from "@/components/reject-application-button"
import { getRoleLabel } from "@/lib/role-labels"
import { parseLocalDate } from "@/lib/calendar"

export default async function ReplacementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user?.is_admin) redirect("/dashboard/replacements")

  const { id } = await params
  const replacementId = Number.parseInt(id)

  // If the ID is not a valid number, redirect back to replacements page
  if (isNaN(replacementId) || replacementId <= 0) {
    redirect("/dashboard/replacements")
  }

  const replacementResult = await sql`
    SELECT 
      r.*,
      l.user_id as leave_user_id,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      t.name as team_name
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    WHERE r.id = ${replacementId}
  `

  if (replacementResult.length === 0) {
    redirect("/dashboard/replacements")
  }

  const replacement = replacementResult[0]
  const applications = await getReplacementApplications(replacementId)

  const groupedApplications = applications.reduce((acc: any, app: any) => {
    const teamKey = app.team_name || "Sans équipe"
    if (!acc[teamKey]) {
      acc[teamKey] = []
    }
    acc[teamKey].push(app)
    return acc
  }, {})

  const getShiftTypeLabel = (type: string) => {
    switch (type) {
      case "day":
        return "Jour (7h-17h)"
      case "night":
        return "Nuit (17h-17h)"
      case "full_24h":
        return "24h (7h-7h)"
      default:
        return type
    }
  }

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard/replacements">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour aux remplacements
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardTitle>
            <CardDescription>
              Remplace {replacement.first_name} {replacement.last_name} • {replacement.team_name} •{" "}
              {getShiftTypeLabel(replacement.shift_type)}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Candidatures ({applications.length})</h2>

        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucune candidature pour ce remplacement</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedApplications).map(([teamName, teamApps]: [string, any]) => (
              <div key={teamName}>
                <h3 className="text-lg font-semibold mb-3 text-foreground">{teamName}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {teamApps.map((application: any) => (
                    <Card key={application.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {application.first_name} {application.last_name}
                            </CardTitle>
                            <CardDescription>
                              {getRoleLabel(application.role)} • {application.email}
                            </CardDescription>
                          </div>
                          <Badge className={getStatusColor(application.status)}>
                            {getStatusLabel(application.status)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Postulé le {parseLocalDate(application.applied_at).toLocaleDateString("fr-CA")}
                          </p>

                          {application.status !== "pending" && application.reviewer_first_name && (
                            <p className="text-sm text-muted-foreground">
                              {application.status === "approved" ? "Approuvée" : "Rejetée"} par{" "}
                              {application.reviewer_first_name} {application.reviewer_last_name} le{" "}
                              {parseLocalDate(application.reviewed_at).toLocaleDateString("fr-CA")}
                            </p>
                          )}

                          {application.status === "pending" && (
                            <div className="flex gap-2">
                              <ApproveApplicationButton applicationId={application.id} />
                              <RejectApplicationButton applicationId={application.id} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
