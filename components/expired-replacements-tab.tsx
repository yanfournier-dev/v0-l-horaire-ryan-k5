"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate, formatShortDate, formatCreatedAt } from "@/lib/date-utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"

interface ExpiredReplacementsTabProps {
  expiredReplacements: any[]
  isAdmin: boolean
  firefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
}

export function ExpiredReplacementsTab({ expiredReplacements, isAdmin, firefighters }: ExpiredReplacementsTabProps) {
  const [sortBy, setSortBy] = useState<"date" | "created_at" | "name" | "candidates">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Helper function to get extra firefighter number
  const getExtraFirefighterNumber = (replacement: any) => {
    if (replacement.user_id !== null) return null
    
    // Normalize shift_date to ISO string for comparison
    const normalizeDate = (date: any) => {
      if (!date) return ""
      if (typeof date === "string") return date.split("T")[0] // Get just the date part
      return new Date(date).toISOString().split("T")[0]
    }
    
    const replacementDateNorm = normalizeDate(replacement.shift_date)
    
    // Get all extras for the same shift, sorted by ID
    const extrasForShift = expiredReplacements
      .filter((r: any) => {
        const isNull = r.user_id === null
        const rDateNorm = normalizeDate(r.shift_date)
        const dateSame = rDateNorm === replacementDateNorm
        const typeSame = r.shift_type === replacement.shift_type
        const teamSame = r.team_id === replacement.team_id
        
        return isNull && dateSame && typeSame && teamSame
      })
      .sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
    
    const index = extrasForShift.findIndex((r: any) => r.id === replacement.id)
    return index >= 0 ? index + 1 : 1
  }

  const sortedReplacements = [...expiredReplacements].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "date":
        comparison = compareShifts(a, b, parseLocalDate)
        break
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case "name":
        const nameA = a.user_id === null ? `Pompier supplémentaire ${getExtraFirefighterNumber(a)}` : `${a.first_name} ${a.last_name}`
        const nameB = b.user_id === null ? `Pompier supplémentaire ${getExtraFirefighterNumber(b)}` : `${b.first_name} ${b.last_name}`
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

  if (!isAdmin) {
    return null
  }

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
            <p className="text-muted-foreground">Aucun remplacement à assigner pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        sortedReplacements.map((replacement: any) => {
          const candidateCount = Number.parseInt(replacement.application_count) || 0

          return (
            <Card key={replacement.id} className="overflow-hidden">
              <CardContent className="py-0 px-1.5">
                <div className="flex items-center gap-2 text-sm">
                  {/* Date and shift type */}
                  <div className="flex items-center gap-1.5 min-w-[140px]">
                    <span className="font-medium leading-none">{formatShortDate(replacement.shift_date)}</span>
                    <Badge
                      className={`${getShiftTypeColor(replacement.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}
                    >
                      {getShiftTypeLabel(replacement.shift_type).split(" ")[0]}
                    </Badge>
                    {/* Part-time team badge */}
                    <PartTimeTeamBadge shiftDate={replacement.shift_date} />
                  </div>

                  {/* Name and team */}
                  <div className="flex-1 min-w-0 leading-none">
                    {replacement.user_id === null ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire {getExtraFirefighterNumber(replacement)}</span>
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
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Créé {formatCreatedAt(replacement.created_at)}
                    </div>
                  </div>

                  <div className="flex gap-0.5 shrink-0">
                    <ApplyForReplacementButton
                      replacementId={replacement.id}
                      isAdmin={isAdmin}
                      firefighters={firefighters}
                      onSuccess={() => {}}
                    />
                    <DeleteReplacementButton replacementId={replacement.id} />
                    <Link href={`/dashboard/replacements/${replacement.id}`}>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-8 text-xs px-2 gap-1 bg-transparent leading-none"
                      >
                        <Users className="h-3 w-3" />
                        <Badge variant="secondary" className="text-[9px] px-0.5 py-0 h-3.5 leading-none">
                          {candidateCount}
                        </Badge>
                      </Button>
                    </Link>
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
