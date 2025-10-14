import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ApproveApplicationButton } from "@/components/approve-application-button"
import { RejectApplicationButton } from "@/components/reject-application-button"
import { getRoleLabel } from "@/lib/role-labels"
import { parseLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { formatReplacementTime } from "@/lib/replacement-utils"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"

export const dynamic = "force-dynamic"

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

  const applications = await sql`
    SELECT 
      ra.*,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      reviewer.first_name as reviewer_first_name,
      reviewer.last_name as reviewer_last_name,
      team_info.name as team_name,
      team_info.type as team_type,
      EXISTS (
        SELECT 1
        FROM replacements r2
        JOIN replacement_applications ra2 ON r2.id = ra2.replacement_id
        WHERE r2.shift_date = ${replacement.shift_date}
          AND r2.shift_type = ${replacement.shift_type}
          AND r2.team_id = ${replacement.team_id}
          AND r2.id != ${replacementId}
          AND ra2.applicant_id = u.id
          AND ra2.status = 'approved'
          AND r2.status = 'assigned'
      ) as is_already_assigned
    FROM replacement_applications ra
    JOIN users u ON ra.applicant_id = u.id
    LEFT JOIN users reviewer ON ra.reviewed_by = reviewer.id
    LEFT JOIN LATERAL (
      SELECT 
        CASE 
          WHEN t.type = 'permanent' THEN 'Pompiers réguliers'
          ELSE t.name
        END as name,
        t.type
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = u.id
      ORDER BY 
        CASE WHEN t.name = 'Pompiers réguliers' THEN 0 ELSE 1 END,
        t.id
      LIMIT 1
    ) team_info ON true
    WHERE ra.replacement_id = ${replacementId}
    ORDER BY 
      CASE 
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%1%' THEN 1
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%2%' THEN 2
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%3%' THEN 3
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%4%' THEN 4
        WHEN team_info.type = 'part_time' THEN 5
        WHEN team_info.type = 'temporary' THEN 6
        WHEN team_info.type = 'permanent' THEN 7
        ELSE 11
      END,
      ra.applied_at DESC
  `

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
            <div className="flex items-start justify-between">
              <div className="flex-1">
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
              </div>
              <DeleteReplacementButton replacementId={replacementId} />
            </div>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Candidats pour ce remplacement ({applications.length})
        </h2>

        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucun candidat disponible pour ce remplacement</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(
              applications.reduce((acc: any, app: any) => {
                const teamKey = app.team_name || "Sans équipe"
                if (!acc[teamKey]) {
                  acc[teamKey] = []
                }
                acc[teamKey].push(app)
                return acc
              }, {}),
            ).map(([teamName, teamApps]: [string, any]) => (
              <div key={teamName}>
                <h3 className="text-lg font-semibold mb-3 text-foreground">{teamName}</h3>
                <div className="space-y-2">
                  {teamApps.map((application: any) => {
                    const isUnsuitableForPartial = replacement.is_partial && !application.is_partial_interest
                    const isAlreadyAssigned = application.is_already_assigned

                    return (
                      <div
                        key={application.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                          isUnsuitableForPartial || isAlreadyAssigned
                            ? "bg-muted/50 opacity-60 border-muted"
                            : "bg-card hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`font-semibold text-foreground ${
                                isUnsuitableForPartial || isAlreadyAssigned ? "line-through" : ""
                              }`}
                            >
                              {application.first_name} {application.last_name}
                            </span>
                            <span className="text-sm text-muted-foreground">{getRoleLabel(application.role)}</span>
                            <span className="text-sm text-muted-foreground">{application.email}</span>
                            {application.is_partial_interest && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                Intéressé par un congé partiel
                              </Badge>
                            )}
                            {isUnsuitableForPartial && (
                              <Badge
                                variant="outline"
                                className="text-red-600 border-red-600 bg-red-50 dark:bg-red-950"
                              >
                                Non disponible pour congé partiel
                              </Badge>
                            )}
                            {isAlreadyAssigned && (
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950"
                              >
                                Déjà assigné à un autre remplacement
                              </Badge>
                            )}
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
                          {application.status === "pending" && !isAlreadyAssigned && (
                            <>
                              <ApproveApplicationButton
                                applicationId={application.id}
                                firefighterName={`${application.first_name} ${application.last_name}`}
                                isPartial={replacement.is_partial}
                                startTime={replacement.start_time}
                                endTime={replacement.end_time}
                              />
                              <RejectApplicationButton applicationId={application.id} />
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
