"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { RequestReplacementDialog } from "@/components/request-replacement-dialog"
import { useState } from "react"

interface UserRequestsTabProps {
  userRequests: any[]
  userId: number
}

export function UserRequestsTab({ userRequests, userId }: UserRequestsTabProps) {
  const [showDialog, setShowDialog] = useState(false)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "rejected":
        return "Rejetée"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Demander un remplacement
        </Button>
      </div>

      {userRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Vous n'avez pas encore demandé de remplacement</p>
          </CardContent>
        </Card>
      ) : (
        userRequests.map((request: any) => (
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
                  <CardDescription>{request.team_name}</CardDescription>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge className={getShiftTypeColor(request.shift_type)}>
                    {getShiftTypeLabel(request.shift_type)}
                  </Badge>
                  <Badge className={getStatusColor(request.status)}>{getStatusLabel(request.status)}</Badge>
                  {request.is_partial && (
                    <Badge variant="outline" className="text-xs">
                      Partiel: {request.start_time?.slice(0, 5)} - {request.end_time?.slice(0, 5)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))
      )}

      <RequestReplacementDialog open={showDialog} onOpenChange={setShowDialog} userId={userId} />
    </div>
  )
}
