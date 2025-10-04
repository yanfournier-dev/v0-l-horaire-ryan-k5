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
import { parseLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { formatReplacementTime } from "@/lib/replacement-utils"

export default async function ReplacementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string; tab?: string }>
}) {
  const user = await getSession()
  if (!user?.is_admin) redirect("/dashboard/replacements")

  const { id } = await params
  const { returnTo, tab } = await searchParams
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

  console.log("[v0] Replacement data:", {
    id: replacement.id,
    is_partial: replacement.is_partial,
    start_time: replacement.start_time,
    end_time: replacement.end_time,
  })

  const applications = await getReplacementApplications(replacementId)

  const filteredApplications = applications.filter((app: any) => {
    const teamName = app.team_name || ""
    return !teamName.match(/^Équipe permanente [1-4]$/i)
  })

  const groupedApplications = filteredApplications.reduce((acc: any, app: any) => {
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
        <Link href={returnTo ? `/dashboard/replacements?tab=${tab || "all"}#${returnTo}` : "/dashboard/replacements"}>
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
              {replacement.first_name} {replacement.last_name} • {replacement.team_name} •{" "}
              {getShiftTypeLabel(replacement.shift_type)}
              {replacement.is_partial && (
                <span className="text-orange-600 dark:text-orange-400">
                  {" • Remplacement partiel "}
                  {formatReplacementTime(replacement.is_partial, replacement.start_time, replacement.end_time)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Candidatures ({filteredApplications.length})</h2>

        {filteredApplications.length === 0 ? (
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
                <div className="space-y-2">
                  {teamApps.map((application: any) => (
                    <div
                      key={application.id}
                      className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-foreground">
                            {application.first_name} {application.last_name}
                          </span>
                          <span className="text-sm text-muted-foreground">{getRoleLabel(application.role)}</span>
                          <span className="text-sm text-muted-foreground">{application.email}</span>
                          <span className="text-sm text-muted-foreground">
                            Postulé le {formatLocalDateTime(application.applied_at)}
                          </span>
                          {application.status !== "pending" && application.reviewer_first_name && (
                            <span className="text-sm text-muted-foreground">
                              {application.status === "approved" ? "Approuvée" : "Rejetée"} par{" "}
                              {application.reviewer_first_name} {application.reviewer_last_name} le{" "}
                              {parseLocalDate(application.reviewed_at).toLocaleDateString("fr-CA")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={getStatusColor(application.status)}>
                          {getStatusLabel(application.status)}
                        </Badge>
                        {application.status === "pending" && (
                          <>
                            <ApproveApplicationButton applicationId={application.id} />
                            <RejectApplicationButton applicationId={application.id} />
                          </>
                        )}
                      </div>
                    </div>
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
