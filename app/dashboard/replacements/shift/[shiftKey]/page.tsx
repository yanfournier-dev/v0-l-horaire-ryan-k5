import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getRoleLabel } from "@/lib/role-labels"
import { parseLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"

export const dynamic = "force-dynamic"

export default async function ShiftCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ shiftKey: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSession()
  if (!user?.is_admin) redirect("/dashboard/replacements")

  const { shiftKey } = await params
  const { tab } = await searchParams

  // Parse shiftKey: "2025-10-15_day_1"
  const [shiftDate, shiftType, teamIdStr] = shiftKey.split("_")
  const teamId = Number.parseInt(teamIdStr)

  if (!shiftDate || !shiftType || isNaN(teamId)) {
    redirect("/dashboard/replacements")
  }

  // Get all replacements for this shift
  const replacements = await sql`
    SELECT 
      r.*,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      COALESCE(leave_user.role, direct_user.role) as requester_role,
      t.name as team_name
    FROM replacements r
    LEFT JOIN leaves l ON r.leave_id = l.id
    LEFT JOIN users leave_user ON l.user_id = leave_user.id
    LEFT JOIN users direct_user ON r.user_id = direct_user.id
    JOIN teams t ON r.team_id = t.id
    WHERE r.shift_date = ${shiftDate}
      AND r.shift_type = ${shiftType}
      AND r.team_id = ${teamId}
      AND r.status IN ('open', 'assigned')
    ORDER BY r.id
  `

  if (replacements.length === 0) {
    redirect("/dashboard/replacements")
  }

  const firstReplacement = replacements[0]

  // Get all applications for all replacements in this shift
  const replacementIds = replacements.map((r: any) => r.id)

  const allApplications = await sql`
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
      r.id as replacement_id,
      EXISTS (
        SELECT 1
        FROM replacements r2
        JOIN replacement_applications ra2 ON r2.id = ra2.replacement_id
        WHERE r2.shift_date = ${shiftDate}
          AND r2.shift_type = ${shiftType}
          AND r2.team_id = ${teamId}
          AND r2.id != r.id
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
        CASE WHEN t.name ILIKE 'Pompiers réguliers' THEN 0 ELSE 1 END,
        t.id
      LIMIT 1
    ) team_info ON true
    JOIN replacements r ON ra.replacement_id = r.id
    WHERE ra.replacement_id = ANY(${replacementIds})
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

  // Group applications by applicant (to show unique candidates)
  const uniqueCandidates = new Map()
  allApplications.forEach((app: any) => {
    if (!uniqueCandidates.has(app.applicant_id)) {
      uniqueCandidates.set(app.applicant_id, {
        ...app,
        replacementIds: [app.replacement_id],
      })
    } else {
      const existing = uniqueCandidates.get(app.applicant_id)
      if (!existing.replacementIds.includes(app.replacement_id)) {
        existing.replacementIds.push(app.replacement_id)
      }
    }
  })

  const candidates = Array.from(uniqueCandidates.values())

  // Group by team
  const groupedCandidates = candidates.reduce((acc: any, app: any) => {
    const teamKey = app.team_name || "Sans équipe"
    if (!acc[teamKey]) {
      acc[teamKey] = []
    }
    acc[teamKey].push(app)
    return acc
  }, {})

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
        <Link href={`/dashboard/replacements?tab=${tab || "all"}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour aux remplacements
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className={getShiftTypeColor(firstReplacement.shift_type)}>
                {getShiftTypeLabel(firstReplacement.shift_type).split(" ")[0]}
              </Badge>
              <CardTitle className="text-2xl">
                {parseLocalDate(firstReplacement.shift_date).toLocaleDateString("fr-CA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardTitle>
            </div>
            <CardDescription>
              {firstReplacement.team_name} • {replacements.length} remplacement
              {replacements.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Remplacements demandés par:</h3>
              <div className="space-y-1">
                {replacements.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <span>
                      {r.user_id === null ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire</span>
                      ) : (
                        <>
                          {r.first_name} {r.last_name}
                        </>
                      )}
                    </span>
                    {r.requester_role && (
                      <span className="text-muted-foreground">({getRoleLabel(r.requester_role)})</span>
                    )}
                    {r.is_partial && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Partiel {r.start_time && r.end_time && `(${r.start_time} - ${r.end_time})`}
                      </Badge>
                    )}
                    <Link href={`/dashboard/replacements/${r.id}?tab=${tab || "all"}`}>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        Assigner
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Banque de candidats ({candidates.length})</h2>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucune candidature pour ce quart</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedCandidates).map(([teamName, teamCandidates]: [string, any]) => (
              <div key={teamName}>
                <h3 className="text-lg font-semibold mb-3 text-foreground">{teamName}</h3>
                <div className="space-y-2">
                  {teamCandidates.map((candidate: any) => {
                    const isAlreadyAssigned = candidate.is_already_assigned

                    return (
                      <div
                        key={candidate.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                          isAlreadyAssigned ? "bg-muted/50 opacity-60 border-muted" : "bg-card hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`font-semibold text-foreground ${isAlreadyAssigned ? "line-through" : ""}`}
                            >
                              {candidate.first_name} {candidate.last_name}
                            </span>
                            <span className="text-sm text-muted-foreground">{getRoleLabel(candidate.role)}</span>
                            <span className="text-sm text-muted-foreground">{candidate.email}</span>
                            {isAlreadyAssigned && (
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950"
                              >
                                Déjà assigné à un autre remplacement
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              Postulé le {formatLocalDateTime(candidate.applied_at)}
                            </span>
                            {candidate.status !== "pending" && candidate.reviewer_first_name && (
                              <span className="text-sm text-muted-foreground">
                                {candidate.status === "approved" ? "Approuvée" : "Rejetée"} par{" "}
                                {candidate.reviewer_first_name} {candidate.reviewer_last_name} le{" "}
                                {parseLocalDate(candidate.reviewed_at).toLocaleDateString("fr-CA")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={getStatusColor(candidate.status)}>{getStatusLabel(candidate.status)}</Badge>
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
