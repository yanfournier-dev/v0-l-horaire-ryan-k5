"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Check, X, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { approveExchange, rejectExchange, getUserExchangeCount } from "@/app/actions/exchanges"
import { useRouter } from "next/navigation"

interface PendingExchangesTabProps {
  exchanges: any[]
}

export function PendingExchangesTab({ exchanges }: PendingExchangesTabProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedExchangeId, setSelectedExchangeId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [exchangeCounts, setExchangeCounts] = useState<Record<number, { count: number; year: number }>>({})

  useEffect(() => {
    const loadExchangeCounts = async () => {
      const counts: Record<number, { count: number; year: number }> = {}
      for (const exchange of exchanges) {
        const year = new Date(exchange.requester_shift_date).getFullYear()
        const result = await getUserExchangeCount(exchange.requester_id, year)
        counts[exchange.id] = { count: result.count || 0, year }
      }
      setExchangeCounts(counts)
    }
    if (exchanges.length > 0) {
      loadExchangeCounts()
    }
  }, [exchanges])

  const handleApprove = async (exchangeId: number) => {
    const countInfo = exchangeCounts[exchangeId]
    if (countInfo && countInfo.count >= 8) {
      if (
        !confirm(
          `Attention: Le pompier a déjà ${countInfo.count} échanges approuvés pour l'année ${countInfo.year}. La limite recommandée est de 8 échanges par année.\n\nVoulez-vous quand même approuver cet échange?`,
        )
      ) {
        return
      }
    } else {
      if (!confirm("Êtes-vous sûr de vouloir approuver cet échange?")) {
        return
      }
    }

    setProcessingId(exchangeId)
    const result = await approveExchange(exchangeId)

    if (result.error) {
      alert(result.error)
    } else {
      if (result.warning) {
        alert(result.warning)
      }
      router.refresh()
    }

    setProcessingId(null)
  }

  const handleRejectClick = (exchangeId: number) => {
    setSelectedExchangeId(exchangeId)
    setRejectReason("")
    setShowRejectDialog(true)
  }

  const handleRejectConfirm = async () => {
    if (!selectedExchangeId) return

    setProcessingId(selectedExchangeId)
    const result = await rejectExchange(selectedExchangeId, rejectReason)

    if (result.error) {
      alert(result.error)
    } else {
      setShowRejectDialog(false)
      router.refresh()
    }

    setProcessingId(null)
  }

  if (exchanges.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune demande d'échange en attente</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {exchanges.map((exchange: any) => {
          const countInfo = exchangeCounts[exchange.id]
          const showWarning = countInfo && countInfo.count >= 8

          return (
            <Card key={exchange.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {exchange.requester_first_name} {exchange.requester_last_name} ↔ {exchange.target_first_name}{" "}
                      {exchange.target_last_name}
                    </CardTitle>
                    <CardDescription>
                      Demandé le {parseLocalDate(exchange.created_at).toLocaleDateString("fr-CA")}
                    </CardDescription>
                    {countInfo && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Échanges de {exchange.requester_first_name} cette année:{" "}
                        <span
                          className={`font-semibold ${countInfo.count >= 8 ? "text-red-600 dark:text-red-400" : ""}`}
                        >
                          {countInfo.count} / 8
                        </span>
                      </p>
                    )}
                  </div>
                  {showWarning && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limite atteinte
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {showWarning && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {exchange.requester_first_name} {exchange.requester_last_name} a déjà {countInfo.count} échanges
                      approuvés pour l'année {countInfo.year}. La limite recommandée est de 8 échanges par année.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Quart de {exchange.requester_first_name}</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm">
                        {parseLocalDate(exchange.requester_shift_date).toLocaleDateString("fr-CA", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{exchange.requester_team_name}</p>
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
                    <p className="text-sm font-medium">Quart de {exchange.target_first_name}</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm">
                        {parseLocalDate(exchange.target_shift_date).toLocaleDateString("fr-CA", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{exchange.target_team_name}</p>
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

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectClick(exchange.id)}
                    disabled={processingId === exchange.id}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(exchange.id)}
                    disabled={processingId === exchange.id}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Approuver
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser l'échange</DialogTitle>
            <DialogDescription>Indiquez la raison du refus (optionnel)</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reject-reason">Raison du refus</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Conflit d'horaire, manque de personnel..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={processingId !== null}>
              Annuler
            </Button>
            <Button onClick={handleRejectConfirm} disabled={processingId !== null} variant="destructive">
              {processingId !== null ? "Traitement..." : "Refuser l'échange"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
