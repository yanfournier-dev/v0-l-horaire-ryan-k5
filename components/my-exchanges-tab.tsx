"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { cancelExchangeRequest } from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"

interface MyExchangesTabProps {
  exchanges: any[]
  userId: number
}

export function MyExchangesTab({ exchanges, userId }: MyExchangesTabProps) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const handleCancel = async (exchangeId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette demande d'échange?")) {
      return
    }

    setCancellingId(exchangeId)
    const result = await cancelExchangeRequest(exchangeId)

    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }

    setCancellingId(null)
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "approved":
        return "Approuvé"
      case "rejected":
        return "Refusé"
      case "cancelled":
        return "Annulé"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (exchanges.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Vous n'avez pas encore demandé d'échange de quart</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {exchanges.map((exchange: any) => {
        const isRequester = exchange.requester_id === userId
        const otherPerson = isRequester
          ? `${exchange.target_first_name} ${exchange.target_last_name}`
          : `${exchange.requester_first_name} ${exchange.requester_last_name}`

        const canCancel = exchange.status === "pending" && isRequester

        return (
          <Card key={exchange.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Échange avec {otherPerson}</CardTitle>
                  <CardDescription>{isRequester ? "Vous avez demandé cet échange" : "Demande reçue"}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(exchange.status)}>{getStatusLabel(exchange.status)}</Badge>
                  {canCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(exchange.id)}
                      disabled={cancellingId === exchange.id}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{isRequester ? "Votre quart" : "Quart demandé"}</p>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm">
                      {parseLocalDate(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <Badge className={`${getShiftTypeColor(exchange.requester_shift_type)} mt-2`}>
                      {getShiftTypeLabel(exchange.requester_shift_type)}
                    </Badge>
                    {exchange.is_partial && exchange.requester_start_time && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        Partiel: {exchange.requester_start_time.slice(0, 5)} - {exchange.requester_end_time.slice(0, 5)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{isRequester ? "Quart souhaité" : "Votre quart"}</p>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm">
                      {parseLocalDate(exchange.target_shift_date).toLocaleDateString("fr-CA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <Badge className={`${getShiftTypeColor(exchange.target_shift_type)} mt-2`}>
                      {getShiftTypeLabel(exchange.target_shift_type)}
                    </Badge>
                    {exchange.is_partial && exchange.target_start_time && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        Partiel: {exchange.target_start_time.slice(0, 5)} - {exchange.target_end_time.slice(0, 5)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {exchange.status === "approved" && exchange.approver_first_name && (
                <p className="text-sm text-muted-foreground mt-4">
                  Approuvé par {exchange.approver_first_name} {exchange.approver_last_name} le{" "}
                  {parseLocalDate(exchange.approved_at).toLocaleDateString("fr-CA")}
                </p>
              )}

              {exchange.status === "rejected" && exchange.rejected_reason && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Raison du refus:</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{exchange.rejected_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
