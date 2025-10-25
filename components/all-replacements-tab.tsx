"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { EditReplacementAssignmentButton } from "@/components/edit-replacement-assignment-button"
import { getShiftTypeColor } from "@/lib/colors"
import { parseLocalDate } from "@/lib/date-utils"
import { ArrowUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"

interface AllReplacementsTabProps {
  allReplacements: any[]
}

export function AllReplacementsTab({ allReplacements }: AllReplacementsTabProps) {
  const [showAssigned, setShowAssigned] = useState(false)
  const [sortBy, setSortBy] = useState<"date" | "name" | "status" | "candidates">("date")

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

  const sortedReplacements = [...filteredReplacements].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return compareShifts(a, b, parseLocalDate)
      case "name":
        const nameA = a.user_id === null ? "Pompier supplémentaire" : `${a.first_name} ${a.last_name}`
        const nameB = b.user_id === null ? "Pompier supplémentaire" : `${b.first_name} ${b.last_name}`
        return nameA.localeCompare(nameB)
      case "status":
        return a.status.localeCompare(b.status)
      case "candidates":
        const countA = Number.parseInt(a.application_count) || 0
        const countB = Number.parseInt(b.application_count) || 0
        return countB - countA // Descending order (most candidates first)
      default:
        return 0
    }
  })

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="status">Statut</SelectItem>
              <SelectItem value="candidates">Nombre de candidats</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="show-assigned" checked={showAssigned} onCheckedChange={setShowAssigned} />
          <Label htmlFor="show-assigned" className="text-sm cursor-pointer">
            Afficher les remplacements assignés
          </Label>
        </div>
      </div>

      {sortedReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {showAssigned ? "Aucun remplacement" : "Aucun remplacement disponible"}
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedReplacements.map((replacement: any) => (
          <Card key={replacement.id} id={`replacement-${replacement.id}`} className="overflow-hidden">
            <CardContent className="py-0 px-1.5">
              <div className="flex items-center gap-2 text-sm leading-none">
                <div className="flex items-center gap-1.5 min-w-[140px]">
                  <span className="text-sm font-medium leading-none">
                    {parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>

                  <Badge
                    className={`${getShiftTypeColor(replacement.shift_type)} text-sm px-1.5 py-0 h-5 leading-none shrink-0`}
                  >
                    {replacement.shift_type === "day" ? "Jour" : "Nuit"}
                  </Badge>
                </div>

                <div className="flex-1 min-w-0 leading-none">
                  {replacement.user_id === null ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Supp.</span>
                  ) : (
                    <span className="truncate">
                      {replacement.first_name} {replacement.last_name}
                    </span>
                  )}
                  {replacement.is_partial && (
                    <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">
                      ({replacement.start_time?.slice(0, 5)}-{replacement.end_time?.slice(0, 5)})
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  <Badge
                    className={`${getReplacementStatusColor(replacement.status)} text-sm px-1.5 py-0 h-5 leading-none`}
                  >
                    {getReplacementStatusLabel(replacement.status)}
                  </Badge>
                </div>

                {replacement.status === "assigned" && replacement.assigned_first_name && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 flex-1 min-w-0 truncate leading-none">
                    → {replacement.assigned_first_name} {replacement.assigned_last_name}
                  </div>
                )}

                <div className="flex gap-0.5 shrink-0">
                  <Link
                    href={`/dashboard/replacements/${replacement.id}?tab=all&returnTo=replacement-${replacement.id}`}
                  >
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2 bg-transparent leading-none">
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
        ))
      )}
    </div>
  )
}
