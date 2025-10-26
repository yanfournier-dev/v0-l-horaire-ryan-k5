import { Badge } from "@/components/ui/badge"
import { getPartTimeTeam } from "@/lib/date-utils"

interface PartTimeTeamBadgeProps {
  shiftDate: string | Date
}

/**
 * Displays a discrete badge showing which part-time firefighter team is on duty
 * for a given shift date. The badge shows "É1", "É2", "É3", or "É4".
 */
export function PartTimeTeamBadge({ shiftDate }: PartTimeTeamBadgeProps) {
  const team = getPartTimeTeam(shiftDate)

  return (
    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 leading-none font-normal text-muted-foreground">
      É{team}
    </Badge>
  )
}
