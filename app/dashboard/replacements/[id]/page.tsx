import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ApproveApplicationButton } from "@/components/approve-application-button"
import { RejectApplicationButton } from "@/components/reject-application-button"
import { ReactivateApplicationButton } from "@/components/reactivate-application-button"
import { getRoleLabel } from "@/lib/role-labels"
import { parseLocalDate, formatLocalDateTime, getPartTimeTeam } from "@/lib/date-utils"
import { formatReplacementTime } from "@/lib/replacement-utils"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { getBatchFirefighterWeeklyHours } from "@/app/actions/weekly-hours"
import { AddManualApplicationDialog } from "@/components/add-manual-application-dialog"
import { checkFirefighterAbsence } from "@/app/actions/leaves"
import { UnassignReplacementButton } from "@/components/unassign-replacement-button"

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

  if (isNaN(replacementId) || replacementId <= 0) {
    redirect("/dashboard/replacements")
  }

  const replacementResult = await sql`
    SELECT 
      r.*,
      l.user_id as leave_user_id,
      COALESCE(leave_user.first_name, direct_user.first_name) as first_name,
      COALESCE(leave_user.last_name, direct_user.last_name) as last_name,
      COALESCE(leave_user.role, direct_user.role) as replaced_role,
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
  const partTimeTeam = getPartTimeTeam(replacement.shift_date)

  const applications = await sql`
    SELECT
      ra.*,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.id as user_id,
      reviewer.first_name as reviewer_first_name,
      reviewer.last_name as reviewer_last_name,
      COALESCE(team_info.name, 'Aucune équipe') as team_name,
      team_info.type as team_type,
      team_info.team_rank,
      team_info.team_number,
      team_info.team_id as candidate_team_id,
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
      ) as is_already_assigned,
      CASE 
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND u.role = 'lieutenant'
             AND team_info.type = 'part_time'
        THEN true
        ELSE false
      END as has_collective_agreement_priority,
      CASE 
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND team_info.type = 'permanent'
             AND team_info.team_id = ${replacement.team_id}
        THEN true
        ELSE false
      END as has_team_priority,
      CASE 
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND u.role = 'lieutenant'
             AND team_info.type = 'part_time'
             AND team_info.name LIKE '%1%'
        THEN 0 + ((${partTimeTeam} - 1 + 3) % 4) * 0.01
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND u.role = 'lieutenant'
             AND team_info.type = 'part_time'
             AND team_info.name LIKE '%2%'
        THEN 0 + ((${partTimeTeam} - 2 + 3) % 4) * 0.01
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND u.role = 'lieutenant'
             AND team_info.type = 'part_time'
             AND team_info.name LIKE '%3%'
        THEN 0 + ((${partTimeTeam} - 3 + 3) % 4) * 0.01
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND u.role = 'lieutenant'
             AND team_info.type = 'part_time'
             AND team_info.name LIKE '%4%'
        THEN 0 + ((${partTimeTeam} - 4 + 3) % 4) * 0.01
        WHEN ${replacement.replaced_role} IN ('captain', 'lieutenant')
             AND team_info.type = 'permanent'
             AND team_info.team_id = ${replacement.team_id}
        THEN 0.5
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%1%' THEN ((${partTimeTeam} - 1 + 3) % 4) + 1
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%2%' THEN ((${partTimeTeam} - 2 + 3) % 4) + 1
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%3%' THEN ((${partTimeTeam} - 3 + 3) % 4) + 1
        WHEN team_info.type = 'part_time' AND team_info.name LIKE '%4%' THEN ((${partTimeTeam} - 4 + 3) % 4) + 1
        WHEN team_info.type = 'part_time' THEN 5
        WHEN team_info.type = 'temporary' THEN 10
        WHEN team_info.type IS NULL THEN 15
        WHEN team_info.type = 'permanent' THEN 20
        ELSE 99
      END as sort_priority
    FROM replacement_applications ra
    JOIN users u ON ra.applicant_id = u.id
    LEFT JOIN users reviewer ON ra.reviewed_by = reviewer.id
    LEFT JOIN (
      SELECT 
        tm.user_id,
        CASE 
          WHEN t.type = 'permanent' THEN 'Pompiers réguliers'
          ELSE t.name
        END as name,
        t.type,
        t.id as team_id,
        tm.team_rank,
        CASE 
          WHEN t.name LIKE '%1%' THEN 1
          WHEN t.name LIKE '%2%' THEN 2
          WHEN t.name LIKE '%3%' THEN 3
          WHEN t.name LIKE '%4%' THEN 4
          ELSE 0
        END as team_number,
        ROW_NUMBER() OVER (
          PARTITION BY tm.user_id 
          ORDER BY 
            CASE WHEN t.name = 'Pompiers réguliers' THEN 0 ELSE 1 END,
            t.id
        ) as rn
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
    ) team_info ON team_info.user_id = u.id AND team_info.rn = 1
    WHERE ra.replacement_id = ${replacementId}
    ORDER BY 
      sort_priority ASC, 
      team_info.team_rank ASC NULLS LAST,
      ra.id
  `

  const userIds = applications.map((app: any) => app.user_id)
  const weeklyHoursMap = await getBatchFirefighterWeeklyHours(userIds, replacement.shift_date)

  const applicationsWithHours = applications.map((app: any) => {
    const calculatedHours = weeklyHoursMap.get(app.user_id) || 0
    const displayHours = app.team_type === "permanent" ? 42 : calculatedHours

    return {
      ...app,
      weeklyHours: displayHours,
      actualWeeklyHours: calculatedHours,
    }
  })

  const absenceChecks = await Promise.all(
    applicationsWithHours.map((app: any) => checkFirefighterAbsence(app.user_id, replacement.shift_date)),
  )

  const applicationsWithAbsences = applicationsWithHours.map((app: any, index: number) => ({
    ...app,
    absenceInfo: absenceChecks[index],
  }))

  const shiftResult = await sql`
    SELECT id FROM shifts
    WHERE team_id = ${replacement.team_id}
      AND shift_type = ${replacement.shift_type}
    LIMIT 1
  `

  const shiftId = shiftResult.length > 0 ? shiftResult[0].id : null

  const teamFirefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.role
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ${replacement.team_id}
    ORDER BY 
      CASE u.role 
        WHEN 'captain' THEN 1 
        WHEN 'lieutenant' THEN 2 
        ELSE 3
      END,
      u.last_name
  `

  const priorityCandidates = applicationsWithAbsences.filter((app: any) => app.has_collective_agreement_priority)
  const teamPriorityCandidates = applicationsWithAbsences.filter((app: any) => app.has_team_priority)
  const regularCandidates = applicationsWithAbsences.filter(
    (app: any) => !app.has_collective_agreement_priority && !app.has_team_priority,
  )

  const allFirefighters = await sql`
    SELECT DISTINCT ON (u.id)
      u.id,
      u.first_name,
      u.last_name,
      u.role,
      u.email,
      team_info.name as team_name
    FROM users u
    LEFT JOIN (
      SELECT 
        tm.user_id,
        CASE 
          WHEN t.type = 'permanent' THEN 'Pompiers réguliers'
          ELSE t.name
        END as name
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
    ) team_info ON team_info.user_id = u.id
    WHERE u.id != ${replacement.leave_user_id || replacement.user_id}
    ORDER BY u.id, u.last_name, u.first_name
  `

  const existingApplicantIds = applicationsWithAbsences.map((app: any) => app.user_id)

  const partTimeCandidates = regularCandidates.filter((app: any) => app.team_type === "part_time")
  const temporaryCandidates = regularCandidates.filter((app: any) => app.team_type === "temporary")
  const permanentCandidates = regularCandidates.filter((app: any) => app.team_type === "permanent")
  const noTeamCandidates = regularCandidates.filter((app: any) => !app.team_type)

  const partTimeByTeam = {
    1: partTimeCandidates.filter((app: any) => app.team_number === 1),
    2: partTimeCandidates.filter((app: any) => app.team_number === 2),
    3: partTimeCandidates.filter((app: any) => app.team_number === 3),
    4: partTimeCandidates.filter((app: any) => app.team_number === 4),
  }

  const rotationOrder = []
  for (let i = 0; i < 4; i++) {
    const teamNum = ((partTimeTeam - 1 + 3 - i) % 4) + 1
    rotationOrder.push(teamNum)
  }

  const renderApplicationCard = (application: any) => {
    const isAlreadyAssigned = application.is_already_assigned
    const cannotBeAssigned = application.has_team_priority
    const isAbsent = application.absenceInfo?.isAbsent || false
    const absenceData = application.absenceInfo?.absence

    return (
      <div
        key={application.id}
        className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
          isAlreadyAssigned ? "bg-muted/50 opacity-60 border-muted" : "bg-card hover:bg-accent/50"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`font-semibold text-foreground ${isAlreadyAssigned ? "line-through" : ""}`}>
              {application.last_name} {application.first_name}
            </span>
            <span className="text-sm text-muted-foreground">{getRoleLabel(application.role)}</span>
            <span className="text-sm text-muted-foreground">{application.email}</span>
            {application.has_collective_agreement_priority && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-semibold">Priorité</Badge>
            )}
            {application.has_team_priority && (
              <Badge className="bg-blue-600 text-white hover:bg-blue-700 font-semibold">Priorité équipe</Badge>
            )}
            {!application.has_collective_agreement_priority && !application.has_team_priority && (
              <span className="text-sm text-muted-foreground">{application.team_name}</span>
            )}
            {(application.has_collective_agreement_priority || application.has_team_priority) && (
              <span className="text-sm text-muted-foreground">{application.team_name}</span>
            )}
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              {application.weeklyHours}h cette semaine
            </Badge>
            {isAbsent && absenceData && (
              <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50 dark:bg-red-950">
                Absent (
                {parseLocalDate(absenceData.start_date).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}{" "}
                - {parseLocalDate(absenceData.end_date).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}
                )
              </Badge>
            )}
            {isAlreadyAssigned && (
              <Badge variant="outline" className="text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950">
                Déjà assigné à un autre remplacement
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Postulé le {formatLocalDateTime(application.applied_at)}
            </span>
            {application.status !== "pending" && application.reviewer_first_name && (
              <span className="text-sm text-muted-foreground">
                {application.status === "approved" ? "Approuvée" : "Rejetée"} par {application.reviewer_first_name}{" "}
                {application.reviewer_last_name} le{" "}
                {parseLocalDate(application.reviewed_at).toLocaleDateString("fr-CA")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={getStatusColor(application.status)}>{getStatusLabel(application.status)}</Badge>
          {cannotBeAssigned && (
            <span className="text-sm text-muted-foreground italic">Candidat pour rôle de lieutenant uniquement</span>
          )}
          {!cannotBeAssigned && application.status === "approved" && (
            <UnassignReplacementButton
              applicationId={application.id}
              firefighterName={`${application.last_name} ${application.first_name}`}
            />
          )}
          {!cannotBeAssigned && application.status === "pending" && !isAlreadyAssigned && (
            <>
              <ApproveApplicationButton
                applicationId={application.id}
                firefighterName={`${application.last_name} ${application.first_name}`}
                isPartial={replacement.is_partial}
                startTime={replacement.start_time}
                endTime={replacement.end_time}
                replacedFirefighterRole={replacement.replaced_role}
                shiftFirefighters={teamFirefighters}
                shiftId={shiftId}
                replacementFirefighterId={application.user_id}
                actualWeeklyHours={application.actualWeeklyHours || application.weeklyHours}
                shiftType={replacement.shift_type}
                teamPriorityCandidates={teamPriorityCandidates.map((c: any) => ({
                  user_id: c.user_id,
                  first_name: c.first_name,
                  last_name: c.last_name,
                  team_rank: c.team_rank,
                }))}
                shiftDate={
                  replacement.shift_date instanceof Date
                    ? replacement.shift_date.toISOString().split("T")[0]
                    : typeof replacement.shift_date === "string"
                      ? replacement.shift_date.split("T")[0]
                      : undefined
                }
              />
              <RejectApplicationButton applicationId={application.id} />
            </>
          )}
          {!cannotBeAssigned && application.status === "rejected" && (
            <ReactivateApplicationButton applicationId={application.id} replacementStatus={replacement.status} />
          )}
        </div>
      </div>
    )
  }

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
                <CardTitle className="text-2xl flex items-center gap-3">
                  {parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold px-3 py-1">
                    Équipe É{partTimeTeam}
                  </Badge>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">
            Candidats pour ce remplacement ({applicationsWithAbsences.length})
          </h2>
          <AddManualApplicationDialog
            replacementId={replacementId}
            availableFirefighters={allFirefighters}
            existingApplicantIds={existingApplicantIds}
          />
        </div>

        {applicationsWithAbsences.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucun candidat disponible pour ce remplacement</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {priorityCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
                  Candidats prioritaires (convention collective)
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-semibold">
                    {priorityCandidates.length}
                  </Badge>
                </h3>
                <div className="space-y-2">{priorityCandidates.map(renderApplicationCard)}</div>
              </div>
            )}

            {teamPriorityCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">
                  Pompiers permanents de {replacement.team_name} (priorité pour rôle de lieutenant)
                </h3>
                <div className="space-y-2">{teamPriorityCandidates.map(renderApplicationCard)}</div>
              </div>
            )}

            {rotationOrder.map((teamNum) => {
              const teamCandidates = partTimeByTeam[teamNum as 1 | 2 | 3 | 4]
              if (teamCandidates.length === 0) return null

              return (
                <div key={`team-${teamNum}`}>
                  <h3 className="text-lg font-semibold mb-3 text-foreground">Équipe Temps Partiel {teamNum}</h3>
                  <div className="space-y-2">{teamCandidates.map(renderApplicationCard)}</div>
                </div>
              )
            })}

            {temporaryCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">Pompiers temporaires</h3>
                <div className="space-y-2">{temporaryCandidates.map(renderApplicationCard)}</div>
              </div>
            )}

            {permanentCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">Pompiers réguliers</h3>
                <div className="space-y-2">{permanentCandidates.map(renderApplicationCard)}</div>
              </div>
            )}

            {noTeamCandidates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">Sans équipe</h3>
                <div className="space-y-2">{noTeamCandidates.map(renderApplicationCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
