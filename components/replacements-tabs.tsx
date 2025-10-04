"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AvailableReplacementsTab } from "@/components/available-replacements-tab"
import { AllReplacementsTab } from "@/components/all-replacements-tab"
import { parseLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"

interface ReplacementsTabsProps {
  recentReplacements: any[]
  userApplications: any[]
  allReplacements: any[]
  firefighters: any[]
  isAdmin: boolean
  initialTab?: string
}

export function ReplacementsTabs({
  recentReplacements,
  userApplications,
  allReplacements,
  firefighters,
  isAdmin,
  initialTab = "open",
}: ReplacementsTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab)

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
    sorted.sort((a, b) => parseLocalDate(a.shift_date).getTime() - parseLocalDate(b.shift_date).getTime())
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

  const sortedRecentReplacements = sortReplacements(recentReplacements)
  const groupedReplacements = groupByShift(sortedRecentReplacements)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="open">
          Disponibles ({recentReplacements.filter((r) => r.status === "open").length})
        </TabsTrigger>
        <TabsTrigger value="my-applications">Mes candidatures ({userApplications.length})</TabsTrigger>
        {isAdmin && <TabsTrigger value="all">Gestion des remplacements</TabsTrigger>}
      </TabsList>

      <TabsContent value="open">
        <AvailableReplacementsTab
          groupedReplacements={groupedReplacements}
          userApplications={userApplications}
          isAdmin={isAdmin}
          firefighters={firefighters}
        />
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
                      {parseLocalDate(application.shift_date).toLocaleDateString("fr-CA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardTitle>
                    <CardDescription>
                      {application.first_name} {application.last_name} • {application.team_name}
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
                  <p>Postulé le {formatLocalDateTime(application.applied_at)}</p>
                  {application.status !== "pending" && application.reviewer_first_name && (
                    <p>
                      {application.status === "approved" ? "Approuvée" : "Rejetée"} par{" "}
                      {application.reviewer_first_name} {application.reviewer_last_name} le{" "}
                      {parseLocalDate(application.reviewed_at).toLocaleDateString("fr-CA")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      {isAdmin && (
        <TabsContent value="all">
          <AllReplacementsTab allReplacements={allReplacements} />
        </TabsContent>
      )}
    </Tabs>
  )
}
