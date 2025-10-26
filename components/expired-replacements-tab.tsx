"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate } from "@/lib/calendar"
import Link from "next/link"
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
  const sortedReplacements = [...expiredReplacements].sort((a, b) => compareShifts(a, b, parseLocalDate))

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-0.5">
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
                    <span className="font-medium leading-none">
                      {parseLocalDate(replacement.shift_date).toLocaleDateString("fr-CA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
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
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Pompier supplémentaire</span>
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
