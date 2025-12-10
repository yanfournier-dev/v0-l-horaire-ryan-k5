"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { cancelExchangeRequest } from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"

interface AllExchangesTabProps {
  exchanges: any[]
  isAdmin: boolean
}

export function AllExchangesTab({ exchanges, isAdmin }: AllExchangesTabProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showPastExchanges, setShowPastExchanges] = useState(false)
  const [sortBy, setSortBy] = useState<
    "requester_date" | "target_date" | "created_at" | "requester_name" | "target_name" | "status"
  >("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const handleDelete = async (exchangeId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet échange?")) {
      return
    }

    setDeletingId(exchangeId)
    const result = await cancelExchangeRequest(exchangeId)

    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }

    setDeletingId(null)
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filteredExchanges = showPastExchanges
    ? exchanges
    : exchanges.filter((exchange: any) => {
        const requesterDate = parseLocalDate(exchange.requester_shift_date)
        const targetDate = parseLocalDate(exchange.target_shift_date)
        return requesterDate >= today || targetDate >= today
      })

  const sortedExchanges = [...filteredExchanges].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "requester_date":
        comparison = parseLocalDate(a.requester_shift_date).getTime() - parseLocalDate(b.requester_shift_date).getTime()
        break
      case "target_date":
        comparison = parseLocalDate(a.target_shift_date).getTime() - parseLocalDate(b.target_shift_date).getTime()
        break
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case "requester_name":
        const nameA = `${a.requester_first_name} ${a.requester_last_name}`
        const nameB = `${b.requester_first_name} ${b.requester_last_name}`
        comparison = nameA.localeCompare(nameB)
        break
      case "target_name":
        const targetNameA = `${a.target_first_name} ${a.target_last_name}`
        const targetNameB = `${b.target_first_name} ${b.target_last_name}`
        comparison = targetNameA.localeCompare(targetNameB)
        break
      case "status":
        comparison = a.status.localeCompare(b.status)
        break
      default:
        comparison = 0
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Date de création</SelectItem>
              <SelectItem value="requester_date">Date du quart demandeur</SelectItem>
              <SelectItem value="target_date">Date du quart cible</SelectItem>
              <SelectItem value="status">Statut</SelectItem>
              <SelectItem value="requester_name">Nom du demandeur</SelectItem>
              <SelectItem value="target_name">Nom de la cible</SelectItem>
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

        <div className="flex items-center gap-2">
          <Checkbox id="show-past-exchanges" checked={showPastExchanges} onCheckedChange={setShowPastExchanges} />
          <Label htmlFor="show-past-exchanges" className="text-sm cursor-pointer">
            Afficher les échanges passés
          </Label>
        </div>
      </div>

      {sortedExchanges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {showPastExchanges ? "Aucun échange trouvé" : "Aucun échange à venir"}
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedExchanges.map((exchange: any) => {
          const canDelete = isAdmin || exchange.status === "pending" || exchange.status === "approved"

          return (
            <Card key={exchange.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {exchange.requester_first_name} {exchange.requester_last_name} ↔ {exchange.target_first_name}{" "}
                      {exchange.target_last_name}
                    </CardTitle>
                    <CardDescription>
                      Demandé le{" "}
                      {parseLocalDate(exchange.created_at).toLocaleDateString("fr-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(exchange.status)}>{getStatusLabel(exchange.status)}</Badge>
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(exchange.id)}
                        disabled={deletingId === exchange.id}
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Quart de {exchange.requester_first_name} ({exchange.requester_team_name})
                    </p>
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
                          Partiel: {exchange.requester_start_time.slice(0, 5)} -{" "}
                          {exchange.requester_end_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Quart de {exchange.target_first_name} ({exchange.target_team_name})
                    </p>
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
        })
      )}
    </div>
  )
}
