"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Plus } from "lucide-react"
import { AvailableReplacementsTab } from "@/components/available-replacements-tab"
import { DirectAssignmentsTab } from "@/components/direct-assignments-tab"
import { PendingRequestsTab } from "@/components/pending-requests-tab"
import { UserRequestsTab } from "@/components/user-requests-tab"
import { WithdrawApplicationButton } from "@/components/withdraw-application-button"
import { RequestReplacementDialog } from "@/components/request-replacement-dialog"
import { ExpiredReplacementsTab } from "@/components/expired-replacements-tab"
import { AssignedReplacementsTab } from "@/components/assigned-replacements-tab"
import { parseLocalDate, formatLocalDateTime, formatShortDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { compareShifts } from "@/lib/shift-sort"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"

interface ReplacementsTabsProps {
  recentReplacements: any[]
  userApplications: any[]
  allReplacements: any[]
  firefighters: any[]
  pendingRequests: any[]
  userRequests: any[]
  expiredReplacements: any[]
  directAssignments: any[]
  assignedReplacements: any[]
  assignedUnsentCount: number // Added unsent count prop
  isAdmin: boolean
  userId: number
  initialTab?: string
}

export function ReplacementsTabs({
  recentReplacements,
  userApplications,
  allReplacements,
  firefighters,
  pendingRequests,
  userRequests,
  expiredReplacements,
  directAssignments,
  assignedReplacements,
  assignedUnsentCount, // Added unsent count
  isAdmin,
  userId,
  initialTab = "available",
}: ReplacementsTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showCompletedApplications, setShowCompletedApplications] = useState(false)
  const [showRequestDialog, setShowRequestDialog] = useState(false)

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

  const sortReplacements = (replacements: any[]) => {
    const sorted = [...replacements]
    sorted.sort((a, b) => compareShifts(a, b, parseLocalDate))
    return sorted
  }

  const groupByShift = (replacements: any[]) => {
    const groups: Record<string, any[]> = {}
    replacements.forEach((replacement) => {
      const date = parseLocalDate(replacement.shift_date)
      const dateStr = date.toISOString().split("T")[0]
      const key = `${dateStr}_${replacement.shift_type}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(replacement)
    })
    return groups
  }

  const replacementsToDisplay = isAdmin ? allReplacements : recentReplacements

  const openReplacements = replacementsToDisplay.filter((r) => {
    if (r.status !== "open") return false
    const isExpired = r.application_deadline && new Date(r.application_deadline) < new Date()
    return !isExpired
  })
  const assignedReplacementsList = replacementsToDisplay.filter((r) => r.status === "assigned")
  const pendingApplications = userApplications.filter((app: any) => app.status === "pending")

  const sortedOpenReplacements = sortReplacements(openReplacements)
  const groupedOpenReplacements = groupByShift(sortedOpenReplacements)

  const filteredApplications = showCompletedApplications
    ? userApplications
    : userApplications.filter((app: any) => app.status === "pending")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <Button onClick={() => setShowRequestDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Demander un remplacement
        </Button>
      </div>

      <TabsList>
        <TabsTrigger value="available">Demandes de remplacement ({openReplacements.length})</TabsTrigger>
        {isAdmin && (
          <TabsTrigger
            value="to-assign"
            className={
              expiredReplacements.length > 0
                ? "data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=inactive]:text-red-600 data-[state=inactive]:font-semibold"
                : ""
            }
          >
            Prêts à assigner ({expiredReplacements.length})
          </TabsTrigger>
        )}
        {isAdmin && (
          <TabsTrigger
            value="assigned"
            className={
              assignedUnsentCount > 0 ? "data-[state=inactive]:text-red-600 data-[state=inactive]:font-semibold" : ""
            }
          >
            Remplacements assignés ({assignedUnsentCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="direct-assignments">Assignations directes ({directAssignments.length})</TabsTrigger>
        <TabsTrigger value="my-applications">Mes candidatures ({pendingApplications.length})</TabsTrigger>
        <TabsTrigger value="my-requests">Mes demandes ({userRequests.length})</TabsTrigger>
        {isAdmin && (
          <TabsTrigger
            value="pending"
            className={
              pendingRequests.length > 0
                ? "data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=inactive]:text-red-600 data-[state=inactive]:font-semibold"
                : ""
            }
          >
            Demandes en attente ({pendingRequests.length})
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="available">
        <AvailableReplacementsTab
          groupedReplacements={groupedOpenReplacements}
          allReplacements={replacementsToDisplay}
          userApplications={userApplications}
          isAdmin={isAdmin}
          firefighters={firefighters}
          userId={userId}
        />
      </TabsContent>

      <TabsContent value="direct-assignments">
        <DirectAssignmentsTab directAssignments={directAssignments} isAdmin={isAdmin} />
      </TabsContent>

      <TabsContent value="my-applications" className="space-y-0.5">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompletedApplications(!showCompletedApplications)}
            className="gap-2"
          >
            {showCompletedApplications ? (
              <>
                <EyeOff className="h-4 w-4" />
                Masquer les candidatures traitées
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Afficher les candidatures traitées
              </>
            )}
          </Button>
        </div>

        {filteredApplications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {showCompletedApplications
                  ? "Vous n'avez pas encore postulé pour des remplacements"
                  : "Vous n'avez aucune candidature en attente"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredApplications
            .sort((a: any, b: any) => compareShifts(a, b, parseLocalDate))
            .map((application: any) => (
              <Card key={application.id} className="overflow-hidden">
                <CardContent className="py-0 px-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {/* Date and shift type */}
                    <div className="flex items-center gap-1.5 min-w-[140px]">
                      <span className="font-medium leading-none">{formatShortDate(application.shift_date)}</span>
                      <Badge
                        className={`${getShiftTypeColor(application.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}
                      >
                        {getShiftTypeLabel(application.shift_type).split(" ")[0]}
                      </Badge>
                      <PartTimeTeamBadge shiftDate={application.shift_date} />
                    </div>

                    {/* Name and team */}
                    <div className="flex-1 min-w-0 leading-none truncate">
                      {application.first_name} {application.last_name} • {application.team_name}
                      {application.is_partial && (
                        <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">
                          ({application.start_time?.slice(0, 5)}-{application.end_time?.slice(0, 5)})
                        </span>
                      )}
                    </div>

                    {/* Assigned replacement firefighter name */}
                    {application.replacement_status === "assigned" && application.assigned_first_name && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 shrink-0 leading-none">
                        → {application.assigned_first_name} {application.assigned_last_name}
                      </div>
                    )}

                    {/* Status badge */}
                    <Badge className={`${getStatusColor(application.status)} text-sm px-1.5 py-0 h-5 leading-none`}>
                      {getStatusLabel(application.status)}
                    </Badge>

                    {/* Applied date */}
                    <div className="text-[10px] text-muted-foreground leading-none shrink-0">
                      {formatLocalDateTime(application.applied_at)}
                    </div>

                    {/* Withdraw button */}
                    {application.status === "pending" && application.replacement_status === "open" && (
                      <WithdrawApplicationButton
                        applicationId={application.id}
                        shiftDate={application.shift_date}
                        shiftType={application.shift_type}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </TabsContent>

      <TabsContent value="my-requests">
        <UserRequestsTab userRequests={userRequests} userId={userId} />
      </TabsContent>

      {isAdmin && (
        <TabsContent value="to-assign">
          <ExpiredReplacementsTab
            expiredReplacements={expiredReplacements}
            isAdmin={isAdmin}
            firefighters={firefighters}
          />
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="assigned">
          <AssignedReplacementsTab
            assignedReplacements={assignedReplacements}
            unsentCount={assignedUnsentCount} // Pass unsent count
          />
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="pending">
          <PendingRequestsTab pendingRequests={pendingRequests} />
        </TabsContent>
      )}

      <RequestReplacementDialog open={showRequestDialog} onOpenChange={setShowRequestDialog} userId={userId} />
    </Tabs>
  )
}
