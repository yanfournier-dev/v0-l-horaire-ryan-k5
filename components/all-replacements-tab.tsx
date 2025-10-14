"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { EditReplacementAssignmentButton } from "@/components/edit-replacement-assignment-button"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate } from "@/lib/date-utils"
import { formatReplacementTime } from "@/lib/replacement-utils"

interface AllReplacementsTabProps {
  allReplacements: any[]
}

export function AllReplacementsTab({ allReplacements }: AllReplacementsTabProps) {
  const [showAssigned, setShowAssigned] = useState(false)

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

  const filteredReplacements = showAssigned ? allReplacements : allReplacements.filter((r) => r.status !== "assigned")

  const shiftGroups: Record<string, any[]> = {}
  filteredReplacements.forEach((replacement: any) => {
    const dateStr = parseLocalDate(replacement.shift_date).toISOString().split("T")[0]
    const shiftKey = `${dateStr}_${replacement.shift_type}_${replacement.team_id}`
    if (!shiftGroups[shiftKey]) {
      shiftGroups[shiftKey] = []
    }
    shiftGroups[shiftKey].push(replacement)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Checkbox id="show-assigned" checked={showAssigned} onCheckedChange={setShowAssigned} />
        <Label htmlFor="show-assigned" className="text-sm cursor-pointer">
          Afficher les remplacements assignés
        </Label>
      </div>

      {filteredReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {showAssigned ? "Aucun remplacement" : "Aucun remplacement disponible"}
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(shiftGroups).map(([shiftKey, shiftReplacements]) => {
          const firstReplacement = shiftReplacements[0]

          return (
            <div key={shiftKey} className="space-y-2">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className={getShiftTypeColor(firstReplacement.shift_type)}>
                    {getShiftTypeLabel(firstReplacement.shift_type).split(" ")[0]}
                  </Badge>
                  <span className="font-medium">
                    {parseLocalDate(firstReplacement.shift_date).toLocaleDateString("fr-CA", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {shiftReplacements.length} remplacement{shiftReplacements.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {shiftReplacements.map((replacement: any) => (
                <Card key={replacement.id} id={`replacement-${replacement.id}`} className="ml-4">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {replacement.user_id === null ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Pompier supplémentaire
                            </span>
                          ) : (
                            <>
                              {replacement.first_name} {replacement.last_name}
                            </>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {replacement.team_name}
                          {replacement.is_partial && (
                            <span className="text-orange-600 dark:text-orange-400">
                              {" • Remplacement partiel"}
                              {formatReplacementTime(
                                replacement.is_partial,
                                replacement.start_time,
                                replacement.end_time,
                              )}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge className={getReplacementStatusColor(replacement.status)}>
                        {getReplacementStatusLabel(replacement.status)}
                      </Badge>
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
                        <Link
                          href={`/dashboard/replacements/${replacement.id}?tab=all&returnTo=replacement-${replacement.id}`}
                        >
                          <Button variant="outline" size="sm">
                            Assigner ({replacement.application_count || 0})
                          </Button>
                        </Link>
                        {replacement.status === "assigned" && replacement.assigned_first_name && (
                          <EditReplacementAssignmentButton
                            replacementId={replacement.id}
                            currentFirefighterName={`${replacement.assigned_first_name} ${replacement.assigned_last_name}`}
                          />
                        )}
                        <DeleteReplacementButton replacementId={replacement.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
