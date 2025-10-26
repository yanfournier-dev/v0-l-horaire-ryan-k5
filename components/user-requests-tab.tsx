"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { parseLocalDate, formatShortDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { compareShifts } from "@/lib/shift-sort"

interface UserRequestsTabProps {
  userRequests: any[]
  userId: number
}

export function UserRequestsTab({ userRequests, userId }: UserRequestsTabProps) {
  const [showAssignedRequests, setShowAssignedRequests] = useState(false)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Disponible"
      case "assigned":
        return "Assigné"
      case "pending":
        return "En attente"
      case "completed":
        return "Complété"
      case "cancelled":
        return "Annulé"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "assigned":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "completed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredRequests = showAssignedRequests
    ? userRequests
    : userRequests.filter((request) => request.status !== "assigned")

  const sortedRequests = [...filteredRequests].sort((a, b) => compareShifts(a, b, parseLocalDate))

  return (
    <div className="space-y-0.5">
      <div className="flex justify-end mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAssignedRequests(!showAssignedRequests)}
          className="gap-2"
        >
          {showAssignedRequests ? (
            <>
              <EyeOff className="h-4 w-4" />
              Masquer les demandes assignées
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Afficher les demandes assignées
            </>
          )}
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {showAssignedRequests
                ? "Vous n'avez pas encore demandé de remplacement"
                : "Vous n'avez aucune demande en attente"}
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedRequests.map((request: any) => (
          <Card key={request.id} className="overflow-hidden">
            <CardContent className="py-0 px-1.5">
              <div className="flex items-center gap-2 text-sm">
                {/* Date and shift type */}
                <div className="flex items-center gap-1.5 min-w-[140px]">
                  <span className="font-medium leading-none">{formatShortDate(request.shift_date)}</span>
                  <Badge className={`${getShiftTypeColor(request.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}>
                    {getShiftTypeLabel(request.shift_type).split(" ")[0]}
                  </Badge>
                  {request.is_partial && (
                    <Badge variant="outline" className="text-sm px-1.5 py-0 h-5 leading-none">
                      {request.start_time?.slice(0, 5)}-{request.end_time?.slice(0, 5)}
                    </Badge>
                  )}
                </div>

                {/* Team name */}
                <div className="flex-1 min-w-0 leading-none truncate">
                  {request.first_name} {request.last_name} • {request.team_name}
                </div>

                {request.status === "assigned" && request.assigned_first_name && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 shrink-0 leading-none">
                    → {request.assigned_first_name} {request.assigned_last_name}
                  </div>
                )}

                {/* Status badge */}
                <Badge className={`${getStatusColor(request.status)} text-sm px-1.5 py-0 h-5 leading-none`}>
                  {getStatusLabel(request.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
