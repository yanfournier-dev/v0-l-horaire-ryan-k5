"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate, formatShortDate, formatCreatedAt } from "@/lib/date-utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"
import { DeadlineTimer } from "@/components/deadline-timer"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"

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
  const [sortBy, setSortBy] = useState<"date" | "created_at" | "name" | "candidates">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const allReplacements: any[] = []
  Object.entries(groupedReplacements).forEach(([dateKey, replacements]) => {
    replacements.forEach((replacement: any) => {
      allReplacements.push(replacement)
    })
  })

  const replacement2 = allReplacements.find((r) => r.replacement_order === 2)
  if (replacement2) {
    console.log("[v0] CLIENT received replacement2:", {
      id: replacement2.id,
      name: replacement2.name,
      first_name: replacement2.first_name,
      last_name: replacement2.last_name,
      firefighter_full_name: replacement2.firefighter_full_name,
      user_id: replacement2.user_id,
      replaced_user_id: replacement2.replaced_user_id,
    })
  }

  const filteredReplacements = allReplacements.filter((replacement) => {
    const isExpired = replacement.application_deadline && new Date(replacement.application_deadline) < new Date()
    return !isExpired
  })

  const sortedReplacements = [...filteredReplacements].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "date":
        comparison = compareShifts(a, b, parseLocalDate)
        break
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case "name":
        const nameA =
          a.replacement_order === 2 || a.user_id === null
            ? a.name || "Sans nom"
            : a.name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Sans nom"
        const nameB =
          b.replacement_order === 2 || b.user_id === null
            ? b.name || "Sans nom"
            : b.name || `${b.first_name || ""} ${b.last_name || ""}`.trim() || "Sans nom"
        comparison = nameA.localeCompare(nameB)
        break
      case "candidates":
        const countA = Number.parseInt(a.application_count) || 0
        const countB = Number.parseInt(b.application_count) || 0
        comparison = countA - countB
        break
      default:
        comparison = 0
    }

    return sortDirection === "asc" ? comparison : -comparison
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
              <SelectItem value="created_at">Date de création</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="candidates">Nombre de candidats</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
          >
            {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {sortedReplacements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun remplacement disponible pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        sortedReplacements.map((replacement: any) => {
          const hasApplied = userApplications.some((app: any) => app.replacement_id === replacement.id)
          const candidateCount = Number.parseInt(replacement.application_count) || 0
          const isOwnReplacement = replacement.user_id === userId
          const isExpired = replacement.application_deadline && new Date(replacement.application_deadline) < new Date()
          // Check if deadline_duration is exactly -1 for first-come replacements
          const isFirstCome = replacement.deadline_duration === -1

          return (
            <Card
              key={replacement.id}
              className={`overflow-hidden ${isFirstCome ? "ring-2 ring-green-500 dark:ring-green-400" : ""}`}
            >
              <CardContent className="py-0 px-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 min-w-[140px]">
                    <span className="font-medium leading-none">{formatShortDate(replacement.shift_date)}</span>
                    <Badge
                      className={`${getShiftTypeColor(replacement.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}
                    >
                      {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                    </Badge>
                    <PartTimeTeamBadge shiftDate={replacement.shift_date} />
                    {isFirstCome && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-1.5 py-0 h-5 leading-none whitespace-nowrap">
                        Sans délai
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 leading-none">
                    {replacement.user_id === null && replacement.replacement_order !== 2 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire</span>
                    ) : (
                      <span className="truncate">{replacement.requester_name || replacement.name || "Sans nom"}</span>
                    )}
                    {replacement.is_partial && (
                      <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">
                        ({replacement.start_time?.slice(0, 5)}-{replacement.end_time?.slice(0, 5)})
                      </span>
                    )}
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Créé {formatCreatedAt(replacement.created_at)}
                    </div>
                  </div>

                  {replacement.status === "assigned" && replacement.assigned_first_name && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 shrink-0 leading-none">
                      → {replacement.assigned_first_name} {replacement.assigned_last_name}
                    </div>
                  )}

                  {replacement.application_deadline && !isExpired && (
                    <DeadlineTimer
                      deadline={replacement.application_deadline}
                      deadlineDuration={replacement.deadline_duration}
                      shiftDate={replacement.shift_date}
                    />
                  )}

                  <div className="shrink-0">
                    {replacement.status === "assigned" ? (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm px-1.5 py-0 h-5 leading-none">
                        Assigné
                      </Badge>
                    ) : isExpired ? (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-sm px-1.5 py-0 h-5 leading-none">
                        Fermé
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    {(isAdmin || (!hasApplied && !isOwnReplacement && !isExpired)) &&
                      replacement.status !== "assigned" && (
                        <ApplyForReplacementButton
                          replacementId={replacement.id}
                          isAdmin={isAdmin}
                          firefighters={firefighters}
                          hasApplied={hasApplied}
                        />
                      )}
                    <Link href={`/dashboard/replacements/${replacement.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-2 gap-0.5 bg-transparent leading-none"
                      >
                        <Users className="h-3 w-3" />
                        <Badge variant="secondary" className="text-[9px] px-0.5 py-0 h-3.5 leading-none">
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
