"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"

interface AvailableReplacementsTabProps {
  groupedReplacements: Record<string, any[]>
  userApplications: any[]
}

export function AvailableReplacementsTab({ groupedReplacements, userApplications }: AvailableReplacementsTabProps) {
  const [showAssigned, setShowAssigned] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Checkbox
          id="show-assigned"
          checked={showAssigned}
          onCheckedChange={(checked) => setShowAssigned(checked as boolean)}
        />
        <Label htmlFor="show-assigned" className="text-sm cursor-pointer">
          Afficher les remplacements assignés
        </Label>
      </div>

      {Object.keys(groupedReplacements).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun remplacement disponible pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedReplacements).map(([key, replacements]) => {
          const filteredReplacements = showAssigned ? replacements : replacements.filter((r) => r.status !== "assigned")

          // Skip this group if all replacements are filtered out
          if (filteredReplacements.length === 0) return null

          const firstReplacement = filteredReplacements[0]

          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {new Date(firstReplacement.shift_date).toLocaleDateString("fr-CA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardTitle>
                    <CardDescription>
                      {filteredReplacements.length} remplacement{filteredReplacements.length > 1 ? "s" : ""}{" "}
                      {showAssigned ? "" : "disponible"}
                      {filteredReplacements.length > 1 && !showAssigned ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Badge className={getShiftTypeColor(firstReplacement.shift_type)}>
                    {getShiftTypeLabel(firstReplacement.shift_type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredReplacements.map((replacement: any) => {
                    const hasApplied = userApplications.some((app: any) => app.replacement_id === replacement.id)
                    const isAssigned = replacement.status === "assigned"

                    return (
                      <div
                        key={replacement.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="text-sm">
                          <p className="font-medium">
                            Remplace {replacement.first_name} {replacement.last_name}
                          </p>
                          <p className="text-muted-foreground">{replacement.team_name}</p>
                          {isAssigned && replacement.assigned_first_name && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              Assigné à {replacement.assigned_first_name} {replacement.assigned_last_name}
                            </p>
                          )}
                        </div>
                        {isAssigned ? (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Assigné
                          </Badge>
                        ) : hasApplied ? (
                          <Badge variant="outline">Candidature soumise</Badge>
                        ) : (
                          <ApplyForReplacementButton replacementId={replacement.id} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
