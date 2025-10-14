"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate } from "@/lib/calendar"
import Link from "next/link"

interface AvailableReplacementsTabProps {
  groupedReplacements: Record<string, any[]>
  userApplications: any[]
  isAdmin: boolean
  firefighters: any[]
  userId: number
}

export function AvailableReplacementsTab({
  groupedReplacements,
  userApplications,
  isAdmin,
  firefighters,
  userId,
}: AvailableReplacementsTabProps) {
  const [showAssigned, setShowAssigned] = useState(false)

  const allReplacements: any[] = []
  Object.entries(groupedReplacements).forEach(([dateKey, replacements]) => {
    replacements.forEach((replacement: any) => {
      allReplacements.push(replacement)
    })
  })

  const filteredReplacements = showAssigned ? allReplacements : allReplacements.filter((r) => r.status !== "assigned")

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

      {filteredReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun remplacement disponible pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        filteredReplacements.map((replacement: any) => {
          const hasApplied = userApplications.some((app: any) => app.replacement_id === replacement.id)
          const candidateCount = Number.parseInt(replacement.application_count) || 0

          return (
            <Card key={replacement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardTitle>
                    <CardDescription>
                      {replacement.user_id === null ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire</span>
                      ) : (
                        <>
                          {replacement.first_name} {replacement.last_name} • {replacement.team_name}
                        </>
                      )}
                      {replacement.is_partial && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {" • Remplacement partiel "}({replacement.start_time?.slice(0, 5)} à{" "}
                          {replacement.end_time?.slice(0, 5)})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge className={getShiftTypeColor(replacement.shift_type)}>
                    {getShiftTypeLabel(replacement.shift_type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {replacement.status === "assigned" && replacement.assigned_first_name && (
                        <p className="text-blue-600 dark:text-blue-400">
                          Assigné à {replacement.assigned_first_name} {replacement.assigned_last_name}
                        </p>
                      )}
                    </div>

                    {replacement.status === "assigned" ? (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Assigné</Badge>
                    ) : hasApplied ? (
                      <Badge variant="outline">Candidature soumise</Badge>
                    ) : (
                      <ApplyForReplacementButton
                        replacementId={replacement.id}
                        isAdmin={isAdmin}
                        firefighters={firefighters}
                      />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/dashboard/replacements/${replacement.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <Users className="mr-2 h-4 w-4" />
                        Voir les candidats
                        <Badge variant="secondary" className="ml-2">
                          {candidateCount}
                        </Badge>
                      </Button>
                    </Link>
                    {isAdmin && <DeleteReplacementButton replacementId={replacement.id} />}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
