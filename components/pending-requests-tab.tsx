"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { approveReplacementRequest, rejectReplacementRequest } from "@/app/actions/replacements"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface PendingRequestsTabProps {
  pendingRequests: any[]
}

export function PendingRequestsTab({ pendingRequests }: PendingRequestsTabProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<number | null>(null)

  const handleApprove = async (replacementId: number) => {
    setProcessingId(replacementId)
    const result = await approveReplacementRequest(replacementId)
    if (result.error) {
      alert(result.error)
    }
    setProcessingId(null)
    router.refresh()
  }

  const handleReject = async (replacementId: number) => {
    setProcessingId(replacementId)
    const result = await rejectReplacementRequest(replacementId)
    if (result.error) {
      alert(result.error)
    }
    setProcessingId(null)
    router.refresh()
  }

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune demande de remplacement en attente</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pendingRequests.map((request: any) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {parseLocalDate(request.shift_date).toLocaleDateString("fr-CA", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </CardTitle>
                <CardDescription>
                  Demandé par {request.first_name} {request.last_name} • {request.team_name}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge className={getShiftTypeColor(request.shift_type)}>{getShiftTypeLabel(request.shift_type)}</Badge>
                {request.is_partial && (
                  <Badge variant="outline" className="text-xs">
                    Partiel: {request.start_time?.slice(0, 5)} - {request.end_time?.slice(0, 5)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(request.id)}
                disabled={processingId === request.id}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Rejeter
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(request.id)}
                disabled={processingId === request.id}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Approuver
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
