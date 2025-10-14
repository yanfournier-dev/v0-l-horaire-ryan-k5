"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
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
import { approveExchange, rejectExchange } from "@/app/actions/exchanges"
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

  const handleApprove = async (exchangeId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir approuver cet échange?")) {
      return
    }

    setProcessingId(exchangeId)
    const result = await approveExchange(exchangeId)

    if (result.error) {
      alert(result.error)
    } else {
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
        {exchanges.map((exchange: any) => (
          <Card key={exchange.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {exchange.requester_first_name} {exchange.requester_last_name} ↔ {exchange.target_first_name}{" "}
                    {exchange.target_last_name}
                  </CardTitle>
                  <CardDescription>
                    Demandé le {parseLocalDate(exchange.created_at).toLocaleDateString("fr-CA")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                        Partiel: {exchange.requester_start_time.slice(0, 5)} - {exchange.requester_end_time.slice(0, 5)}
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
        ))}
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
